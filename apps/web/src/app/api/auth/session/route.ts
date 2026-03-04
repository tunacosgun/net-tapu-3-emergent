import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

const COOKIE_OPTS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

function jwtMaxAge(token: string, fallback: number): number {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    );
    if (payload.exp) {
      return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
    }
  } catch {
    /* ignore decode errors */
  }
  return fallback;
}

/** POST — persist auth session in httpOnly cookies */
export async function POST(request: NextRequest) {
  const { accessToken, refreshToken, role } = await request.json();
  const jar = cookies();

  // httpOnly session indicator — readable by middleware, NOT by JS
  jar.set('nettapu_session', '1', {
    ...COOKIE_OPTS,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
  });

  // httpOnly role for middleware admin gate
  jar.set('nettapu_role', role || 'user', {
    ...COOKIE_OPTS,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
  });

  // httpOnly refresh token — never exposed to JS
  jar.set('nettapu_rt', refreshToken, {
    ...COOKIE_OPTS,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
  });

  // Access token — NOT httpOnly (JS reads it for API Authorization header)
  jar.set('nettapu_at', accessToken, {
    ...COOKIE_OPTS,
    httpOnly: false,
    maxAge: jwtMaxAge(accessToken, 60 * 60),
  });

  return NextResponse.json({ ok: true });
}

/** DELETE — clear all session cookies */
export async function DELETE() {
  const jar = cookies();
  for (const name of [
    'nettapu_session',
    'nettapu_role',
    'nettapu_rt',
    'nettapu_at',
    'has_session',
    'role',
  ]) {
    jar.delete(name);
  }
  return NextResponse.json({ ok: true });
}
