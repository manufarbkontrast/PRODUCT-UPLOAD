import { cookies } from 'next/headers';

const SESSION_COOKIE = 'spz-session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

export function getCredentials() {
  const username = process.env.APP_USERNAME || 'admin';
  const pin = process.env.APP_PIN || '1234';
  return { username, pin };
}

export function createSessionToken(username: string): string {
  const payload = { username, ts: Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function verifySessionToken(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (!payload.username || !payload.ts) return false;
    // Token ist maximal 30 Tage gueltig
    const age = Date.now() - payload.ts;
    return age < SESSION_MAX_AGE * 1000;
  } catch {
    return false;
  }
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;
  if (!verifySessionToken(session.value)) return null;
  return session.value;
}

export async function isAuthenticated(): Promise<boolean> {
  if (process.env.AUTH_DISABLED === 'true') return true;
  const session = await getSession();
  return session !== null;
}
