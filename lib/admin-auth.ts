import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Validate admin token from request header using timing-safe comparison.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateAdminToken(request: NextRequest): NextResponse | null {
  const token = request.headers.get('X-Admin-Token');
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken) {
    console.error('[Auth] ADMIN_TOKEN nicht konfiguriert');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use timing-safe comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (tokenBuffer.length !== expectedBuffer.length || !timingSafeEqual(tokenBuffer, expectedBuffer)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
