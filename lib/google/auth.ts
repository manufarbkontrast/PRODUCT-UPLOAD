import { google } from 'googleapis';
import type { Credentials } from 'google-auth-library';
import * as path from 'path';
import * as fs from 'fs';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
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

/**
 * Get Google Auth specifically for Drive operations.
 * Prefers OAuth2 (user has storage quota) over Service Account (0 GB quota).
 * Falls back to Service Account if OAuth2 is not available or invalid.
 */
async function getGoogleAuthForDrive() {
  // 1. Try OAuth2 first — user has storage quota, service accounts do NOT
  if (useOAuth2) {
    const tokens = loadSavedTokens();
    if (tokens && tokens.refresh_token) {
      try {
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials(tokens);
        // Validate by requesting a fresh access token
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        oauth2Client.on('tokens', (newTokens) => {
          const updatedTokens = { ...tokens, ...newTokens };
          persistTokensToFile(updatedTokens);
        });
        console.log('[Auth] Using OAuth2 for Drive (user has storage quota)');
        return oauth2Client;
      } catch (oauthError) {
        console.warn('[Auth] OAuth2 token refresh failed, falling back to Service Account:', oauthError);
      }
    }
  }

  // 2. Fall back to Service Account
  console.log('[Auth] Using Service Account for Drive');
  return getGoogleAuth();
}

export async function getDriveClient() {
  const auth = await getGoogleAuthForDrive();
  return google.drive({ version: 'v3', auth });
}

/**
 * Get authentication status.
 */
export function getAuthStatus(): {
  method: 'oauth2' | 'service_account' | 'none';
  configured: boolean;
  ready: boolean;
  driveAuth: 'oauth2' | 'service_account' | 'none';
  authUrl?: string;
} {
  const hasEnvServiceAccount = !!loadServiceAccountFromEnv();
  const hasFileServiceAccount = serviceAccountFileExists();
  const hasServiceAccount = hasEnvServiceAccount || hasFileServiceAccount;

  const tokens = useOAuth2 ? loadSavedTokens() : null;
  const hasOAuth2 = !!(tokens && tokens.refresh_token);

  // Drive prefers OAuth2 (user has quota) over Service Account
  const driveAuth = hasOAuth2 ? 'oauth2' : hasServiceAccount ? 'service_account' : 'none';

  const configured = hasServiceAccount || hasOAuth2;
  const ready = driveAuth !== 'none';

  return {
    method: hasServiceAccount ? 'service_account' : hasOAuth2 ? 'oauth2' : 'none',
    configured,
    ready,
    driveAuth,
    authUrl: hasOAuth2 ? undefined : (useOAuth2 ? getAuthUrl() : undefined),
  };
}
