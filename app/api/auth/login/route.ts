import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

interface VerifyUserResult {
  id: string;
  username: string;
  display_name: string;
}

export async function POST(request: NextRequest) {
  try {
    const { username, pin } = await request.json();

    if (!username?.trim() || !pin) {
      return NextResponse.json(
        { error: 'Benutzername und PIN sind erforderlich' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Look up user in DB and verify PIN via bcrypt
    const { data: user, error } = await supabase
      .rpc('verify_user_pin', {
        p_username: username.trim().toLowerCase(),
        p_pin: String(pin),
      })
      .maybeSingle<VerifyUserResult>();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Falscher Benutzername oder PIN' },
        { status: 401 }
      );
    }

    // Update last_login_at
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Create HMAC-signed session token (async — uses Web Crypto)
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
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
