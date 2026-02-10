import { NextRequest, NextResponse } from 'next/server';
import { getCredentials, createSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, pin } = await request.json();
    const creds = getCredentials();

    if (username !== creds.username || String(pin) !== String(creds.pin)) {
      return NextResponse.json(
        { error: 'Falscher Benutzername oder PIN' },
        { status: 401 }
      );
    }

    const token = createSessionToken(username);

    const response = NextResponse.json({ success: true });
    response.cookies.set('spz-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Login fehlgeschlagen' },
      { status: 500 }
    );
  }
}
