import { cookies } from 'next/headers';

const SESSION_COOKIE = 'spz-session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

/** Secret for HMAC signing */
function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }
  return secret || 'dev-only-fallback-secret-not-for-production';
}

export interface SessionPayload {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly ts: number;
}

/**
 * Convert string to Uint8Array (Edge-compatible, no Node Buffer needed)
 */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Base64url encode (Edge-compatible)
 */
function base64urlEncode(str: string): string {
  // Use btoa for edge compatibility
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64url decode (Edge-compatible)
 */
function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}

/**
 * Create HMAC-SHA256 signature using Web Crypto API (Edge-compatible)
 */
async function hmacSign(data: string): Promise<string> {
  const secretBytes = stringToBytes(getSecret());
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const dataBytes = stringToBytes(data);
  const signature = await crypto.subtle.sign('HMAC', key, dataBytes.buffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Verify HMAC-SHA256 signature using Web Crypto API (Edge-compatible, timing-safe)
 */
async function hmacVerify(data: string, signature: string): Promise<boolean> {
  const secretBytes = stringToBytes(getSecret());
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  // Convert hex signature back to bytes
  const sigBytes = new Uint8Array(
    (signature.match(/.{2}/g) ?? []).map(byte => parseInt(byte, 16))
  );
  const dataBytes = stringToBytes(data);
  // crypto.subtle.verify is timing-safe
  return crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, dataBytes.buffer as ArrayBuffer);
}

/**
 * Create an HMAC-signed session token.
 * Format: base64url(payload).hex_hmac_signature
 */
export async function createSessionToken(payload: Omit<SessionPayload, 'ts'>): Promise<string> {
  const fullPayload: SessionPayload = { ...payload, ts: Date.now() };
  const data = base64urlEncode(JSON.stringify(fullPayload));
  const signature = await hmacSign(data);
  return `${data}.${signature}`;
}

/**
 * Verify and decode an HMAC-signed session token.
 * Returns the payload if valid, null if invalid or expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const dotIndex = token.indexOf('.');
    if (dotIndex === -1) return null;

    const data = token.substring(0, dotIndex);
    const signature = token.substring(dotIndex + 1);
    if (!data || !signature) return null;

    // Verify HMAC signature (timing-safe via Web Crypto)
    const isValid = await hmacVerify(data, signature);
    if (!isValid) return null;

    // Decode and validate payload
    const payload: SessionPayload = JSON.parse(base64urlDecode(data));

    if (!payload.userId || !payload.username || !payload.ts) return null;

    // Check expiration
    const age = Date.now() - payload.ts;
    if (age > SESSION_MAX_AGE * 1000) return null;
    if (age < 0) return null; // future timestamp = tampered

    return payload;
  } catch {
    return null;
  }
}

/**
 * Get the current session from cookies.
 */
export async function getSession(): Promise<SessionPayload | null> {
  if (process.env.AUTH_DISABLED === 'true') return null;

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;

  return verifySessionToken(session.value);
}

/**
 * Check if the current request is authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  if (process.env.AUTH_DISABLED === 'true') return true;
  const session = await getSession();
  return session !== null;
}

/** Cookie configuration */
export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE;
