import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { defaultPermissionsForRole, findAuthUser } from '@/lib/authUsersStore';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const managedUser = findAuthUser(session.username);
  const effectiveRole = managedUser?.role || session.role || 'User';
  const permissions = managedUser?.permissions
    || session.permissions
    || defaultPermissionsForRole(effectiveRole);

  return NextResponse.json({
    authenticated: true,
    username: session.username,
    role: effectiveRole,
    email: managedUser?.email || session.email,
    fullName: managedUser?.fullName || session.fullName || session.username,
    permissions,
    dashboardPath: '/dashboard',
    dashboardVariant: effectiveRole === 'Admin' ? 'admin' : 'user',
  });
}
