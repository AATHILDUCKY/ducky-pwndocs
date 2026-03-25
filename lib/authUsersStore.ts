import fs from 'node:fs';
import path from 'node:path';

export type ReportPermissions = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
};

export type AuthUserRecord = {
  username: string;
  role: 'Admin' | 'Analyst' | 'Viewer' | 'User';
  email?: string;
  fullName?: string;
  permissions?: ReportPermissions;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'auth-users.json');

const ensureStoreFile = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ users: [] }, null, 2), 'utf-8');
  }
};

const readStore = (): { users: AuthUserRecord[] } => {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { users?: AuthUserRecord[] };
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
  } catch {
    return { users: [] };
  }
};

const writeStore = (payload: { users: AuthUserRecord[] }) => {
  ensureStoreFile();
  fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
};

export const defaultPermissionsForRole = (role?: AuthUserRecord['role']): ReportPermissions => {
  if (role === 'Viewer') {
    return { canView: true, canCreate: false, canEdit: false };
  }
  return { canView: true, canCreate: true, canEdit: true };
};

const normalizePermissions = (
  role?: AuthUserRecord['role'],
  permissions?: Partial<ReportPermissions> | null
): ReportPermissions => {
  const base = defaultPermissionsForRole(role);
  return {
    canView: permissions?.canView ?? base.canView,
    canCreate: permissions?.canCreate ?? base.canCreate,
    canEdit: permissions?.canEdit ?? base.canEdit,
  };
};

export const findAuthUser = (username: string): AuthUserRecord | null => {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return null;
  const found = readStore().users.find((user) => user.username.trim().toLowerCase() === normalized) || null;
  if (!found) return null;

  return {
    ...found,
    permissions: normalizePermissions(found.role, found.permissions),
  };
};

export const findAuthUserByIdentifier = (identifier: string): AuthUserRecord | null => {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;

  const users = readStore().users;
  const found =
    users.find((user) => user.username.trim().toLowerCase() === normalized) ||
    users.find((user) => (user.email || '').trim().toLowerCase() === normalized) ||
    null;

  if (!found) return null;

  return {
    ...found,
    permissions: normalizePermissions(found.role, found.permissions),
  };
};

export const upsertAuthUser = (payload: {
  username: string;
  role?: AuthUserRecord['role'];
  email?: string;
  fullName?: string;
  permissions?: Partial<ReportPermissions>;
  passwordHash?: string;
}) => {
  const username = payload.username.trim();
  const now = new Date().toISOString();
  const store = readStore();

  const existing = store.users.find((user) => user.username.toLowerCase() === username.toLowerCase());

  if (existing) {
    const nextRole = payload.role || existing.role;
    const next: AuthUserRecord = {
      ...existing,
      role: nextRole,
      email: payload.email ?? existing.email,
      fullName: payload.fullName ?? existing.fullName,
      permissions: normalizePermissions(nextRole, payload.permissions ?? existing.permissions),
      passwordHash: payload.passwordHash || existing.passwordHash,
      updatedAt: now,
    };

    writeStore({
      users: store.users.map((user) => (user.username.toLowerCase() === username.toLowerCase() ? next : user)),
    });

    return next;
  }

  const created: AuthUserRecord = {
    username,
    role: payload.role || 'User',
    email: payload.email,
    fullName: payload.fullName || username,
    permissions: normalizePermissions(payload.role || 'User', payload.permissions),
    passwordHash: payload.passwordHash || '',
    createdAt: now,
    updatedAt: now,
  };

  writeStore({ users: [created, ...store.users] });
  return created;
};

export const removeAuthUser = (username: string): boolean => {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return false;

  const store = readStore();
  const before = store.users.length;
  const users = store.users.filter((user) => user.username.trim().toLowerCase() !== normalized);

  if (users.length === before) return false;
  writeStore({ users });
  return true;
};

export const listAuthUsers = (): AuthUserRecord[] => {
  return readStore().users.map((user) => ({
    ...user,
    permissions: normalizePermissions(user.role, user.permissions),
  }));
};
