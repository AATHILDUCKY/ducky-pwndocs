import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getAdminCredentials,
  getSessionTTLSeconds,
  isValidAdminLogin,
  verifyPasswordSecure,
} from '@/lib/auth';
import { defaultPermissionsForRole, findAuthUserByIdentifier } from '@/lib/authUsersStore';

type LoginPayload = {
  identifier?: string;
  username?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  let payload: LoginPayload = {};

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const identifier = payload.identifier?.trim() || payload.username?.trim() || payload.email?.trim() || '';
  const password = payload.password?.trim() || '';

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Username or email and password are required.' }, { status: 400 });
  }

  if (!isValidAdminLogin(identifier, password)) {
    const managedUser = findAuthUserByIdentifier(identifier);
    if (!managedUser || !verifyPasswordSecure(password, managedUser.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const token = createSessionToken(managedUser.username, {
      role: managedUser.role,
      email: managedUser.email,
      fullName: managedUser.fullName,
      permissions: managedUser.permissions || defaultPermissionsForRole(managedUser.role),
    });
    const response = NextResponse.json({
      ok: true,
      role: managedUser.role,
      permissions: managedUser.permissions || defaultPermissionsForRole(managedUser.role),
      dashboardPath: '/dashboard',
      dashboardVariant: managedUser.role === 'Admin' ? 'admin' : 'user',
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: getSessionTTLSeconds(),
    });

    return response;
  }

  const admin = getAdminCredentials();
  const token = createSessionToken(admin.username, {
    role: 'Admin',
    email: admin.email,
    fullName: admin.fullName,
    permissions: { canView: true, canCreate: true, canEdit: true },
  });
  const response = NextResponse.json({
    ok: true,
    role: 'Admin',
    permissions: { canView: true, canCreate: true, canEdit: true },
    dashboardPath: '/dashboard',
    dashboardVariant: 'admin',
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: getSessionTTLSeconds(),
  });

  return response;
}
