import { NextResponse } from 'next/server';
import { isJtlStocksConfigured, refreshCache } from '@/lib/jtl-stocks';
import { google } from 'googleapis';
import { getGoogleAuth, getAuthStatus } from '@/lib/google/auth';

// Allow up to 60s for the initial data load (133MB from Drive)
export const maxDuration = 60;

/**
 * POST /api/jtl-warmup
 * Lädt die JTL-Bestandsdaten aus Google Drive in den Cache.
 * Sollte nach dem Deploy oder bei Cold Start aufgerufen werden.
 */
export async function POST() {
  if (!isJtlStocksConfigured()) {
    return NextResponse.json(
      { error: 'JTL_STOCKS_FOLDER_ID nicht konfiguriert' },
      { status: 500 }
    );
  }

  try {
    const startTime = Date.now();
    await refreshCache();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      message: `JTL-Daten geladen in ${elapsed}s`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Cache-Laden fehlgeschlagen: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jtl-warmup
 * Schritt-für-Schritt Diagnose: testet Service Account UND OAuth2.
 */
export async function GET() {
  const folderId = process.env.JTL_STOCKS_FOLDER_ID || '';
  const steps: Record<string, unknown> = {};

  // Step 1: Service Account test
  try {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    const folderRes = await drive.files.get({
      fileId: folderId,
      supportsAllDrives: true,
      fields: 'id, name',
    });
    steps.serviceAccount = { status: 'OK', folderName: folderRes.data.name };
  } catch (e) {
    steps.serviceAccount = `FAILED: ${e instanceof Error ? e.message : e}`;
  }

  // Step 2: OAuth2 test (direct HTTP, bypass googleapis)
  try {
    const tokensB64 = process.env.GOOGLE_OAUTH_TOKENS;
    if (!tokensB64) {
      steps.oauth2 = 'GOOGLE_OAUTH_TOKENS not set';
    } else {
      const tokens = JSON.parse(Buffer.from(tokensB64, 'base64').toString('utf-8'));

      // Refresh the access token
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const refreshData = await refreshRes.json();

      if (!refreshData.access_token) {
        steps.oauth2 = { status: 'REFRESH FAILED', error: refreshData.error, desc: refreshData.error_description };
      } else {
        // Try to access the folder with the fresh token
        const folderRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name&supportsAllDrives=true`,
          { headers: { Authorization: `Bearer ${refreshData.access_token}` } }
        );
        const folderData = await folderRes.json();

        if (folderData.error) {
          steps.oauth2 = { status: 'FOLDER ACCESS FAILED', error: folderData.error.message };
        } else {
          // List files in folder
          const listRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,size)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
            { headers: { Authorization: `Bearer ${refreshData.access_token}` } }
          );
          const listData = await listRes.json();
          steps.oauth2 = {
            status: 'OK',
            folderName: folderData.name,
            files: (listData.files || []).map((f: { name: string; size: string }) => ({ name: f.name, size: f.size })),
          };
        }
      }
    }
  } catch (e) {
    steps.oauth2 = `ERROR: ${e instanceof Error ? e.message : e}`;
  }

  return NextResponse.json({ folderId: folderId.substring(0, 10) + '...', steps });
}
