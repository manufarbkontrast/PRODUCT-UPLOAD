import { NextResponse } from 'next/server';
import {
  GOOGLE_CONFIG,
  listFiles,
  getSheetInfo,
  appendToSheet,
  readSheet,
} from '@/lib/google';

export async function GET() {
  try {
    // Test Google Drive connection
    const files = await listFiles(GOOGLE_CONFIG.DRIVE_FOLDER_ID, 10);

    // Test Google Sheets connection
    const sheetInfo = await getSheetInfo();

    return NextResponse.json({
      success: true,
      message: 'Google API connection successful!',
      config: {
        driveFolderId: GOOGLE_CONFIG.DRIVE_FOLDER_ID,
        spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
      },
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
    console.error('Google API test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Test writing to sheet
    const testData = [
      ['Test', new Date().toISOString(), 'Hello from API'],
    ];

    const rowsAdded = await appendToSheet(testData);

    // Read back the data
    const data = await readSheet();

    return NextResponse.json({
      success: true,
      message: 'Test data written successfully!',
      rowsAdded,
      currentData: data,
    });
  } catch (error) {
    console.error('Google Sheets write test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
