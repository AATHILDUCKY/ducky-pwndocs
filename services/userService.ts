import type { ManagedUser, ReportPermissions, UserProfile, UserProfileInput, UserRole } from '../types';
import { readStore, writeStore } from './webStore';
import { recordChange } from './auditService';

const nowIso = () => new Date().toISOString();

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');

const hashPassword = async (value: string): Promise<string> => {
  const normalized = value.trim();
  if (!normalized) return '';

  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return toHex(new Uint8Array(digest));
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'utf-8').toString('hex');
  }

  return normalized;
};

const syncCredentialStore = async (payload: {
  action: 'upsert' | 'password' | 'delete';
  username: string;
  password?: string;
  role?: UserRole;
  email?: string;
  fullName?: string;
  permissions?: Partial<ReportPermissions>;
}) => {
  if (typeof window === 'undefined') return;

  const response = await fetch('/api/admin/user-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to sync user credentials.');
  }
};

const getDefaultPermissions = (role: UserRole): ReportPermissions => {
  if (role === 'Viewer') {
    return { canView: true, canCreate: false, canEdit: false };
  }
  return { canView: true, canCreate: true, canEdit: true };
};

const normalizeUser = (
  input: Omit<Partial<ManagedUser>, 'permissions'> & {
    username: string;
    role?: UserRole;
    permissions?: Partial<ReportPermissions>;
  }
): ManagedUser => {
  const role: UserRole = (input.role as UserRole) || 'Analyst';
  return {
    id: input.id || `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: input.username.trim(),
    fullName: input.fullName || input.username,
    role,
    email: input.email || '',
    avatarColor: input.avatarColor || '#4f46e5',
    avatarUrl: input.avatarUrl || '',
    isSystem: Boolean(input.isSystem),
    permissions: {
      ...getDefaultPermissions(role),
      ...(input.permissions || {}),
    },
    createdAt: input.createdAt || nowIso(),
    updatedAt: nowIso(),
    passwordHash: input.passwordHash,
    passwordUpdatedAt: input.passwordUpdatedAt,
  };
};

type ServerUser = {
  username: string;
  role?: UserRole;
  email?: string;
  fullName?: string;
  permissions?: Partial<ReportPermissions>;
  createdAt?: string;
  updatedAt?: string;
};

const userIdForUsername = (username: string) =>
  `u-${username.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'user'}`;

export const fetchUsers = async (): Promise<ManagedUser[]> => {
  const localUsers = readStore().users || [];

  if (typeof window === 'undefined') return localUsers;

  try {
    const response = await fetch('/api/admin/user-credentials', { cache: 'no-store' });
    if (!response.ok) return localUsers;

    const body = (await response.json()) as { users?: ServerUser[] };
    const serverUsers = Array.isArray(body.users) ? body.users : [];
    if (!serverUsers.length) return localUsers;

    const localByUsername = new Map(
      localUsers.map((user) => [user.username.trim().toLowerCase(), user])
    );
    const users = serverUsers.map((user) => {
      const username = user.username.trim();
      const existing = localByUsername.get(username.toLowerCase());
      return normalizeUser({
        ...existing,
        id: existing?.id || userIdForUsername(username),
        username,
        fullName: user.fullName || existing?.fullName || username,
        email: user.email || existing?.email || '',
        role: user.role || existing?.role || 'User',
        permissions: user.permissions || existing?.permissions,
        avatarColor: existing?.avatarColor,
        avatarUrl: existing?.avatarUrl,
        isSystem: (user.role || existing?.role) === 'Admin' && !existing?.passwordUpdatedAt,
        createdAt: user.createdAt || existing?.createdAt,
      });
    });

    writeStore((store) => {
      const activeStillExists = users.some((user) => user.id === store.activeUserId);
      const activeUserId = activeStillExists ? store.activeUserId : users[0]?.id || null;
      const userProfile = users.find((user) => user.id === activeUserId) || users[0] || store.userProfile;

      return {
        ...store,
        users,
        activeUserId,
        userProfile,
      };
    });

    return users;
  } catch {
    return localUsers;
  }
};

export const ensureAdminUser = async (payload: { username: string; email?: string; fullName?: string }): Promise<ManagedUser> => {
  const adminUsername = payload.username.trim() || 'admin';
  let ensured: ManagedUser | null = null;

  writeStore((store) => {
    const existingAdmin = (store.users || []).find((user) => user.username === adminUsername && user.role === 'Admin');

    if (existingAdmin) {
      const updatedAdmin: ManagedUser = {
        ...existingAdmin,
        fullName: payload.fullName || existingAdmin.fullName || 'Administrator',
        email: payload.email || existingAdmin.email || `${adminUsername}@localhost`,
        permissions: { canView: true, canCreate: true, canEdit: true },
        isSystem: true,
        updatedAt: nowIso(),
      };

      ensured = updatedAdmin;

      return {
        ...store,
        users: (store.users || []).map((user) => (user.id === updatedAdmin.id ? updatedAdmin : user)),
        activeUserId: store.activeUserId || updatedAdmin.id,
        userProfile: store.userProfile || updatedAdmin,
      };
    }

    const createdAdmin = normalizeUser({
      username: adminUsername,
      fullName: payload.fullName || 'Administrator',
      email: payload.email || `${adminUsername}@localhost`,
      role: 'Admin',
      isSystem: true,
      permissions: { canView: true, canCreate: true, canEdit: true },
    });

    ensured = createdAdmin;

    return {
      ...store,
      users: [createdAdmin, ...(store.users || [])],
      activeUserId: store.activeUserId || createdAdmin.id,
      userProfile: store.userProfile || createdAdmin,
    };
  });

  return ensured as ManagedUser;
};

export const setActiveUser = async (userId: string): Promise<ManagedUser | null> => {
  let selected: ManagedUser | null = null;

  writeStore((store) => {
    const found = (store.users || []).find((user) => user.id === userId) || null;
    selected = found;
    if (!found) return store;

    return {
      ...store,
      activeUserId: found.id,
      userProfile: found,
    };
  });

  return selected;
};

export const fetchActiveUser = async (): Promise<ManagedUser | null> => {
  const store = readStore();
  if (!(store.users || []).length) return null;
  const selected = store.activeUserId
    ? store.users.find((user) => user.id === store.activeUserId)
    : store.users[0];
  return selected || null;
};

export const createManagedUser = async (input: {
  username: string;
  fullName?: string;
  email?: string;
  role?: UserRole;
  permissions?: Partial<ReportPermissions>;
  password?: string;
}): Promise<ManagedUser | null> => {
  if (!input.username?.trim()) return null;
  if (!input.password?.trim()) return null;

  await syncCredentialStore({
    action: 'upsert',
    username: input.username.trim(),
    password: input.password.trim(),
    role: input.role || 'Analyst',
    email: input.email,
    fullName: input.fullName,
    permissions: input.permissions,
  });

  let created: ManagedUser | null = null;

  writeStore((store) => {
    const exists = (store.users || []).some((user) => user.username.toLowerCase() === input.username.trim().toLowerCase());
    if (exists) return store;

    const next = normalizeUser({
      username: input.username,
      fullName: input.fullName,
      email: input.email,
      role: input.role || 'Analyst',
      permissions: input.permissions,
      passwordHash: undefined,
      passwordUpdatedAt: nowIso(),
    });

    created = next;

    return {
      ...store,
      users: [next, ...(store.users || [])],
      activeUserId: store.activeUserId || next.id,
    };
  });

  if (created) {
    recordChange({
      action: 'Created user account',
      targetType: 'user',
      targetId: created.id,
      targetName: created.username,
      details: `Role: ${created.role}`,
    });
  }

  return created;
};

export const updateManagedUser = async (input: ManagedUser): Promise<ManagedUser | null> => {
  if (!input?.id) return null;

  const nextUser = normalizeUser({ ...input, createdAt: input.createdAt, id: input.id, username: input.username, role: input.role });
  let updated: ManagedUser | null = null;

  try {
    await syncCredentialStore({
      action: 'upsert',
      username: nextUser.username,
      role: nextUser.role,
      email: nextUser.email,
      fullName: nextUser.fullName,
      permissions: nextUser.permissions,
    });
  } catch {
    // Keep local profile updates functional when endpoint access is restricted.
  }

  writeStore((store) => {
    const hasUser = (store.users || []).some((user) => user.id === nextUser.id);
    if (!hasUser) return store;

    updated = nextUser;

    const users = (store.users || []).map((user) => (user.id === nextUser.id ? nextUser : user));
    const isActive = store.activeUserId === nextUser.id;

    return {
      ...store,
      users,
      userProfile: isActive ? nextUser : store.userProfile,
    };
  });

  if (updated) {
    recordChange({
      action: 'Updated user account',
      targetType: 'user',
      targetId: updated.id,
      targetName: updated.username,
      details: `Role: ${updated.role}`,
    });
  }

  return updated;
};

export const setManagedUserPassword = async (userId: string, password: string): Promise<ManagedUser | null> => {
  const nextPasswordHash = await hashPassword(password);
  if (!nextPasswordHash) return null;

  const store = readStore();
  const target = (store.users || []).find((user) => user.id === userId);
  if (!target) return null;

  await syncCredentialStore({
    action: 'password',
    username: target.username,
    password,
  });

  let updated: ManagedUser | null = null;
  const changedAt = nowIso();

  writeStore((store) => {
    const nextTarget = (store.users || []).find((user) => user.id === userId);
    if (!nextTarget) return store;

    updated = {
      ...nextTarget,
      passwordHash: undefined,
      passwordUpdatedAt: changedAt,
      updatedAt: changedAt,
    };

    const users = (store.users || []).map((user) => (user.id === userId ? (updated as ManagedUser) : user));
    const isActive = store.activeUserId === userId;

    return {
      ...store,
      users,
      userProfile: isActive ? updated : store.userProfile,
    };
  });

  if (updated) {
    recordChange({
      action: 'Updated user password',
      targetType: 'user',
      targetId: updated.id,
      targetName: updated.username,
    });
  }

  return updated;
};

export const deleteManagedUser = async (userId: string): Promise<boolean> => {
  const target = (readStore().users || []).find((user) => user.id === userId) || null;
  if (!target || target.role === 'Admin' || target.isSystem) return false;

  await syncCredentialStore({
    action: 'delete',
    username: target.username,
  });

  writeStore((store) => {
    const users = (store.users || []).filter((user) => user.id !== userId);
    const fallback = users[0] || null;

    return {
      ...store,
      users,
      activeUserId: store.activeUserId === userId ? fallback?.id || null : store.activeUserId,
      userProfile: store.activeUserId === userId ? fallback : store.userProfile,
    };
  });

  recordChange({
    action: 'Deleted user account',
    targetType: 'user',
    targetId: target.id,
    targetName: target.username,
  });

  return true;
};

export const fetchUserProfile = async (): Promise<UserProfile | null> => {
  const active = await fetchActiveUser();
  if (active) return active;
  return readStore().userProfile;
};

export const createUserProfile = async (input: UserProfileInput): Promise<UserProfile | null> => {
  const profile: ManagedUser = normalizeUser({
    username: input.username,
    fullName: input.fullName,
    role: (input.role as UserRole) || 'Analyst',
    email: input.email,
    avatarColor: input.avatarColor,
    avatarUrl: input.avatarUrl,
  });

  writeStore((store) => ({
    ...store,
    users: [profile, ...(store.users || [])],
    userProfile: profile,
    activeUserId: profile.id,
  }));

  return profile;
};

export const updateUserProfile = async (input: UserProfile & UserProfileInput): Promise<UserProfile | null> => {
  if (!input?.id) return null;

  const store = readStore();
  const existing = (store.users || []).find((user) => user.id === input.id);

  if (existing) {
    const merged: ManagedUser = {
      ...existing,
      ...input,
      role: existing.role,
      permissions: existing.permissions,
      updatedAt: nowIso(),
    };

    return updateManagedUser(merged);
  }

  const fallback: UserProfile = {
    ...input,
    updatedAt: nowIso(),
  };

  writeStore((nextStore) => ({
    ...nextStore,
    userProfile: fallback,
  }));

  return fallback;
};
