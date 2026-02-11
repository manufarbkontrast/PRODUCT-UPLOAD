import { NextResponse } from 'next/server';
import { isAuthenticated, getSession } from '@/lib/auth';

export async function GET() {
  const authed = await isAuthenticated();

  if (!authed) {
    return NextResponse.json({ authenticated: false });
  }

  const session = await getSession();

  return NextResponse.json({
    authenticated: true,
    user: session
      ? {
          id: session.userId,
          username: session.username,
          displayName: session.displayName,
        }
      : null,
  });
}
