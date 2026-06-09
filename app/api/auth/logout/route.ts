import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, shouldUseSecureCookies } from '@/lib/auth';

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: shouldUseSecureCookies(request.url),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
