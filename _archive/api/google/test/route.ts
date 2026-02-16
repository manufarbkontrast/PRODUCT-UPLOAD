import { NextResponse } from 'next/server';
import {
  getOrCreateDriveFolderId,
  getOrCreateSpreadsheetId,
  getAuthStatus,
  getDriveClient,
  listFiles,
  getSheetInfo,
} from '@/lib/google';

/**
 * GET: Test Google Drive + Sheets connection.
 * Auto-creates folder and spreadsheet if they don't exist.
 */
export async function GET() {
  try {
    const authStatus = getAuthStatus();
    const driveFolderId = await getOrCreateDriveFolderId();
    const spreadsheetId = await getOrCreateSpreadsheetId();
    const files = await listFiles(driveFolderId, 10);
    const sheetInfo = await getSheetInfo();

    return NextResponse.json({
      success: true,
      message: 'Google API connection successful!',
      auth: { method: authStatus.method, ready: authStatus.ready },
      config: { driveFolderId, spreadsheetId },
      drive: {
        filesCount: files.length,
        files: files.map((f) => ({ id: f.id, name: f.name })),
      },
      sheets: {
        title: sheetInfo.title,
        sheetsCount: sheetInfo.sheets.length,
        sheets: sheetInfo.sheets,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Google API test failed:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST: Test write access by creating and immediately deleting a test folder.
 */
export async function POST() {
  try {
    const drive = await getDriveClient();
    const folderId = await getOrCreateDriveFolderId();

    const response = await drive.files.create({
      requestBody: {
        name: `SPZ-Test-${Date.now()}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId],
      },
      fields: 'id, name',
    });

    if (response.data.id) {
      await drive.files.delete({ fileId: response.data.id });
    }

    return NextResponse.json({
      success: true,
      message: 'Drive write test passed (folder created and deleted).',
    });
  } catch (error) {
    console.error('Google Drive write test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
