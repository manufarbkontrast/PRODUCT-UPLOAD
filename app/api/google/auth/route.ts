import { NextResponse } from 'next/server';
import { getAuthStatus, getAuthUrl } from '@/lib/google/auth';

export async function GET() {
  try {
    const status = getAuthStatus();

    return NextResponse.json({
      ...status,
      message: status.ready
        ? 'Google authentication is ready'
        : 'Google authentication required. Please authorize the app.',
    });
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { error: 'Failed to get auth status', details: String(error) },
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
      { error: 'Failed to generate auth URL', details: String(error) },
      { status: 500 }
    );
  }
}
