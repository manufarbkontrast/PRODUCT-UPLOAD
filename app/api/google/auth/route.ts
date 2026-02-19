import { NextResponse } from 'next/server';
import { getAuthStatus, getAuthUrl, loadSavedTokens, getOAuth2Client } from '@/lib/google/auth';

export async function GET() {
  try {
    const status = getAuthStatus();
    const tokens = loadSavedTokens();

    // Test token refresh to detect issues early
    let refreshTest = 'skipped';
    if (tokens && tokens.refresh_token) {
      try {
        const client = getOAuth2Client();
        client.setCredentials(tokens);
        await client.refreshAccessToken();
        refreshTest = 'ok';
      } catch (refreshErr) {
        refreshTest = refreshErr instanceof Error ? refreshErr.message : String(refreshErr);
      }
    }

    return NextResponse.json({
      ...status,
      refreshTest,
      hasTokens: !!tokens,
      hasRefreshToken: !!(tokens && tokens.refresh_token),
      tokenExpiryDate: tokens?.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      message: status.ready
        ? 'Google authentication is ready'
        : 'Google authentication required. Please authorize the app.',
    });
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { error: 'Failed to get auth status' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Auth URL generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
