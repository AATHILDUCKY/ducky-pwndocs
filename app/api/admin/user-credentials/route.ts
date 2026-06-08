import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  getAdminCredentials,
  hashPasswordSecure,
  verifySessionToken,
} from '@/lib/auth';
import { findAuthUser, listAuthUsers, removeAuthUser, upsertAuthUser } from '@/lib/authUsersStore';

type UpsertPayload = {
  action: 'upsert';
  username: string;
  password?: string;
  role?: 'Admin' | 'Analyst' | 'Viewer' | 'User';
  email?: string;
  fullName?: string;
  permissions?: {
    canView?: boolean;
    canCreate?: boolean;
    canEdit?: boolean;
  };
};

type PasswordPayload = {
  action: 'password';
  username: string;
  password: string;
};

type DeletePayload = {
  action: 'delete';
  username: string;
};

type Payload = UpsertPayload | PasswordPayload | DeletePayload;

const getSession = (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
};

const isAdminSession = (request: NextRequest) => {
  const session = getSession(request);
  if (!session) return false;
  if (session.role === 'Admin') return true;

  const admin = getAdminCredentials();
  return session.username === admin.username;
};

export async function GET(request: NextRequest) {
  if (!isAdminSession(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = getAdminCredentials();
  const adminUsername = admin.username.trim();
  let managedUsers;
  try {
    managedUsers = listAuthUsers().map((user) => ({
      username: user.username,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
      permissions: user.permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  } catch (error) {
    console.error('Failed to read users', error);
    return NextResponse.json({ error: 'User data store is unavailable. Check APP_DATA_DIR permissions.' }, { status: 500 });
  }
  const hasPrimaryAdmin = managedUsers.some(
    (user) => user.username.trim().toLowerCase() === adminUsername.toLowerCase()
  );
  const users = hasPrimaryAdmin
    ? managedUsers
    : [
        {
          username: adminUsername,
          role: 'Admin' as const,
          email: admin.email,
          fullName: admin.fullName,
          permissions: { canView: true, canCreate: true, canEdit: true },
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...managedUsers,
      ];

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  if (!isAdminSession(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (payload.action === 'upsert') {
    if (!payload.username?.trim()) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }
    const username = payload.username.trim();
    const existing = findAuthUser(username);
    if (!existing && !payload.password?.trim()) {
      return NextResponse.json({ error: 'Password is required when creating a new user.' }, { status: 400 });
    }

    let user;
    try {
      user = upsertAuthUser({
        username,
        role: payload.role || 'User',
        email: payload.email,
        fullName: payload.fullName,
        permissions: payload.permissions,
        passwordHash: payload.password?.trim() ? hashPasswordSecure(payload.password.trim()) : undefined,
      });
    } catch (error) {
      console.error('Failed to save user', error);
      return NextResponse.json({ error: 'Unable to save user. Check APP_DATA_DIR permissions.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, username: user.username });
  }

  if (payload.action === 'password') {
    if (!payload.username?.trim() || !payload.password?.trim()) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    let user;
    try {
      user = upsertAuthUser({
        username: payload.username.trim(),
        passwordHash: hashPasswordSecure(payload.password.trim()),
      });
    } catch (error) {
      console.error('Failed to update user password', error);
      return NextResponse.json({ error: 'Unable to update password. Check APP_DATA_DIR permissions.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, username: user.username });
  }

  if (payload.action === 'delete') {
    if (!payload.username?.trim()) {
      return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    }

    const normalized = payload.username.trim();
    const actor = getSession(request);
    const adminUsername = getAdminCredentials().username.trim().toLowerCase();
    if (normalized.toLowerCase() === adminUsername) {
      return NextResponse.json({ error: 'Primary admin account cannot be deleted.' }, { status: 400 });
    }
    if (actor && normalized.toLowerCase() === actor.username.trim().toLowerCase()) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    let deleted = false;
    try {
      deleted = removeAuthUser(normalized);
    } catch (error) {
      console.error('Failed to delete user', error);
      return NextResponse.json({ error: 'Unable to delete user. Check APP_DATA_DIR permissions.' }, { status: 500 });
    }
    return NextResponse.json({ ok: deleted });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}
