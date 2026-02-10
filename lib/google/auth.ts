import { google } from 'googleapis';
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
 * Get OAuth2 client for user authentication
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
 * Generate OAuth2 authorization URL
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string): Promise<OAuth2Tokens> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  // Save tokens to file for persistence
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

  return tokens as OAuth2Tokens;
}

/**
 * Load saved OAuth2 tokens
 */
export function loadSavedTokens(): OAuth2Tokens | null {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const content = fs.readFileSync(TOKEN_PATH, 'utf-8');
      return JSON.parse(content) as OAuth2Tokens;
    }
  } catch (error) {
    console.error('Error loading OAuth tokens:', error);
  }
  return null;
}

/**
 * Check if OAuth2 is configured and has valid tokens
 */
export function isOAuth2Ready(): boolean {
  if (!useOAuth2) return false;
  const tokens = loadSavedTokens();
  return !!(tokens && tokens.refresh_token);
}

/**
 * Get Google Auth - uses OAuth2 if configured and has tokens, otherwise falls back to Service Account
 */
export async function getGoogleAuth() {
  // Try OAuth2 first if configured
  if (useOAuth2) {
    const tokens = loadSavedTokens();
    if (tokens && tokens.refresh_token) {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials(tokens);

      // Auto-refresh token if expired
      oauth2Client.on('tokens', (newTokens) => {
        const updatedTokens = { ...tokens, ...newTokens };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(updatedTokens, null, 2));
      });

      return oauth2Client;
    }
  }

  // Fall back to Service Account
  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_PATH,
      scopes: SCOPES,
    });
    return auth;
  }

  throw new Error('No valid Google authentication configured. Please set up OAuth2 or Service Account.');
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
 * Get authentication status
 */
export function getAuthStatus(): {
  method: 'oauth2' | 'service_account' | 'none';
  configured: boolean;
  ready: boolean;
  authUrl?: string;
} {
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

  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    return {
      method: 'service_account',
      configured: true,
      ready: true,
    };
  }

  return {
    method: 'none',
    configured: false,
    ready: false,
  };
}
