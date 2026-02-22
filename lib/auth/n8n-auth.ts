import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Validate the n8n shared secret from request header using timing-safe comparison.
 * Uses N8N_SHARED_SECRET env var, falling back to ADMIN_TOKEN for backward compatibility.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateN8nToken(request: NextRequest): NextResponse | null {
  const token = request.headers.get('X-Admin-Token');
  const expectedToken = process.env.N8N_SHARED_SECRET || process.env.ADMIN_TOKEN;

  if (!expectedToken) {
    console.error('[n8n-auth] Neither N8N_SHARED_SECRET nor ADMIN_TOKEN configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (tokenBuffer.length !== expectedBuffer.length || !timingSafeEqual(tokenBuffer, expectedBuffer)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
