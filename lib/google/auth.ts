import { google } from 'googleapis';
import type { Credentials } from 'google-auth-library';
import * as path from 'path';
import * as fs from 'fs';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
];

const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'google-service-account.json');
const TOKEN_PATH = path.join(process.cwd(), 'google-oauth-token.json');

// Check if OAuth2 credentials are configured
const useOAuth2 = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

interface OAuth2Tokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Decode a base64-encoded JSON string into a parsed object.
 * Returns null if the input is missing or malformed.
 */
function decodeBase64Json<T>(base64Value: string | undefined): T | null {
  if (!base64Value) return null;
  try {
    const jsonString = Buffer.from(base64Value, 'base64').toString('utf-8');
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Failed to decode base64 JSON:', error);
    return null;
  }
}

/**
 * Load OAuth tokens from GOOGLE_OAUTH_TOKENS environment variable (base64-encoded JSON).
 */
function loadTokensFromEnv(): OAuth2Tokens | null {
  return decodeBase64Json<OAuth2Tokens>(process.env.GOOGLE_OAUTH_TOKENS);
}

/**
 * Load OAuth tokens from the local token file.
 */
function loadTokensFromFile(): OAuth2Tokens | null {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const content = fs.readFileSync(TOKEN_PATH, 'utf-8');
      return JSON.parse(content) as OAuth2Tokens;
    }
  } catch (error) {
    console.error('Error loading OAuth tokens from file:', error);
  }
  return null;
}

/**
 * Safely persist tokens to the filesystem.
 * On read-only filesystems (e.g. Vercel), the write will fail gracefully
 * and the tokens are logged so they can be saved to the environment variable.
 * Accepts partial token objects from the googleapis refresh callback.
 */
function persistTokensToFile(tokens: OAuth2Tokens | Credentials): void {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  } catch {
    console.warn(
      '[Google Auth] Could not write tokens to filesystem (expected on Vercel).',
      'Set GOOGLE_OAUTH_TOKENS env var with this base64 value:',
      Buffer.from(JSON.stringify(tokens)).toString('base64')
    );
  }
}

/**
 * Load service account credentials from GOOGLE_SERVICE_ACCOUNT_JSON env var (base64-encoded).
 */
function loadServiceAccountFromEnv(): Record<string, unknown> | null {
  return decodeBase64Json<Record<string, unknown>>(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

/**
 * Check if the service account JSON file exists on disk.
 */
function serviceAccountFileExists(): boolean {
  try {
    return fs.existsSync(SERVICE_ACCOUNT_PATH);
  } catch {
    return false;
  }
}

/**
 * Get OAuth2 client for user authentication.
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate OAuth2 authorization URL.
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens.
 */
export async function getTokensFromCode(code: string): Promise<OAuth2Tokens> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  const oauthTokens = tokens as OAuth2Tokens;

  persistTokensToFile(oauthTokens);

  return oauthTokens;
}

/**
 * Load saved OAuth2 tokens.
 * Tries the environment variable first (for Vercel / serverless),
 * then falls back to the local file (for local development).
 */
export function loadSavedTokens(): OAuth2Tokens | null {
  const envTokens = loadTokensFromEnv();
  if (envTokens) return envTokens;

  return loadTokensFromFile();
}

/**
 * Check if OAuth2 is configured and has valid tokens.
 */
export function isOAuth2Ready(): boolean {
  if (!useOAuth2) return false;
  const tokens = loadSavedTokens();
  return !!(tokens && tokens.refresh_token);
}

/**
 * Create a GoogleAuth instance from parsed service account credentials.
 */
function createAuthFromCredentials(credentials: Record<string, unknown>) {
  return new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
}

/**
 * Get Google Auth - prefers Service Account (more reliable on serverless),
 * falls back to OAuth2 for local development with user-scoped access.
 */
export async function getGoogleAuth() {
  // 1. Service Account from environment variable (Vercel / serverless)
  const envCredentials = loadServiceAccountFromEnv();
  if (envCredentials) {
    return createAuthFromCredentials(envCredentials);
  }

  // 2. Service Account from file (local development)
  if (serviceAccountFileExists()) {
    return new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_PATH,
      scopes: SCOPES,
    });
  }

  // 3. OAuth2 as fallback (local development with user-scoped access)
  if (useOAuth2) {
    const tokens = loadSavedTokens();
    if (tokens && tokens.refresh_token) {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials(tokens);

      // Auto-refresh token if expired
      oauth2Client.on('tokens', (newTokens) => {
        const updatedTokens = { ...tokens, ...newTokens };
        persistTokensToFile(updatedTokens);
      });

      return oauth2Client;
    }
  }

  throw new Error(
    'No valid Google authentication configured. ' +
    'Set GOOGLE_SERVICE_ACCOUNT_JSON (base64) or GOOGLE_OAUTH_TOKENS (base64) env vars, ' +
    'or provide local credential files.'
  );
}

export async function getDriveClient() {
  const auth = await getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

export async function getSheetsClient() {
  const auth = await getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Get authentication status.
 */
export function getAuthStatus(): {
  method: 'oauth2' | 'service_account' | 'none';
  configured: boolean;
  ready: boolean;
  authUrl?: string;
} {
  // Mirror the same priority as getGoogleAuth(): Service Account first
  const hasEnvServiceAccount = !!loadServiceAccountFromEnv();
  const hasFileServiceAccount = serviceAccountFileExists();

  if (hasEnvServiceAccount || hasFileServiceAccount) {
    return {
      method: 'service_account',
      configured: true,
      ready: true,
    };
  }

  if (useOAuth2) {
    const tokens = loadSavedTokens();
    const ready = !!(tokens && tokens.refresh_token);
    return {
      method: 'oauth2',
      configured: true,
      ready,
      authUrl: ready ? undefined : getAuthUrl(),
    };
  }

  return {
    method: 'none',
    configured: false,
    ready: false,
  };
}
