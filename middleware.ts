import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

// Routes die KEINE Auth brauchen
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/',
  '/api/health',
  '/api/webhooks/',
  '/api/internal/',
  '/_next/',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths durchlassen
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Static files durchlassen
  if (pathname.includes('.')) {
    return NextResponse.next();
  }

  // Auth disabled? Alles durchlassen
  if (process.env.AUTH_DISABLED === 'true') {
    return NextResponse.next();
  }

  // Session pruefen (verifySessionToken is async — uses Web Crypto API)
  const sessionCookie = request.cookies.get('spz-session');
  const session = sessionCookie?.value
    ? await verifySessionToken(sessionCookie.value)
    : null;

  if (!session) {
    // API-Requests bekommen 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
    }
    // Seiten-Requests werden zu /login umgeleitet
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
