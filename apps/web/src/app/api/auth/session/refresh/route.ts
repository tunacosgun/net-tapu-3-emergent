import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const COOKIE_OPTS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

function decodeRole(token: string): string {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    );
    return payload.roles?.includes('superadmin')
      ? 'superadmin'
      : payload.roles?.includes('admin')
        ? 'admin'
        : 'user';
  } catch {
    return 'user';
  }
}

function jwtMaxAge(token: string, fallback: number): number {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    );
    if (payload.exp) {
      return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** POST — server-side token refresh using httpOnly RT cookie */
export async function POST() {
  const jar = cookies();
  const rt = jar.get('nettapu_rt')?.value;

  if (!rt) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const apiUrl = process.env.API_URL || 'http://localhost:3000';

  try {
    const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });

    if (!res.ok) {
      for (const name of ['nettapu_session', 'nettapu_role', 'nettapu_rt', 'nettapu_at']) {
        jar.delete(name);
      }
      return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
    }

    const data = await res.json();
    const { accessToken, refreshToken } = data;
    const role = decodeRole(accessToken);

    jar.set('nettapu_session', '1', { ...COOKIE_OPTS, httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
    jar.set('nettapu_role', role, { ...COOKIE_OPTS, httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
    jar.set('nettapu_rt', refreshToken, { ...COOKIE_OPTS, httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
    jar.set('nettapu_at', accessToken, { ...COOKIE_OPTS, httpOnly: false, maxAge: jwtMaxAge(accessToken, 60 * 60) });

    return NextResponse.json({ accessToken, refreshToken });
  } catch {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
