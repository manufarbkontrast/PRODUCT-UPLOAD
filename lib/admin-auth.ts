import { NextRequest, NextResponse } from 'next/server';

export function validateAdminToken(request: NextRequest): NextResponse | null {
  const token = request.headers.get('X-Admin-Token');
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken) {
    console.error('[Auth] ADMIN_TOKEN nicht konfiguriert');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
