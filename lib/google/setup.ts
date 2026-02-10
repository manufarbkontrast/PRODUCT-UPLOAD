import { getDriveClient, getSheetsClient } from './auth';

/**
 * In-memory cache for auto-created Google resource IDs.
 * These persist for the lifetime of the server process.
 */
let cachedDriveFolderId: string | null = null;
let cachedSpreadsheetId: string | null = null;

const ROOT_FOLDER_NAME = 'SPZ-Product-Integration';
const SPREADSHEET_NAME = 'SPZ-Product-Data';

const SHEET_HEADERS = [
  'Timestamp',
  'Product ID',
  'EAN',
  'Name',
  'Gender',
  'Category',
  'Description',
  'SKU',
  'Drive Folder',
  'Image Count',
  'Image URLs',
];

/**
 * Search for an existing folder by name in Drive root.
 */
async function findFolderByName(name: string): Promise<string | null> {
  const drive = await getDriveClient();

  const response = await drive.files.list({
    q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files || [];
  return files.length > 0 ? files[0].id! : null;
}

/**
 * Search for an existing spreadsheet by name in a folder.
 */
async function findSpreadsheetByName(name: string, folderId: string): Promise<string | null> {
  const drive = await getDriveClient();

  const response = await drive.files.list({
    q: `name = '${name}' and mimeType = 'application/vnd.google-apps.spreadsheet' and '${folderId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files || [];
  return files.length > 0 ? files[0].id! : null;
}

/**
 * Ensure the root Drive folder exists.
 * If GOOGLE_DRIVE_FOLDER_ID is set in env, uses that.
 * Otherwise, searches for or creates the folder.
 */
export async function getOrCreateDriveFolderId(): Promise<string> {
  // 1. Check env var
  const envFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (envFolderId) {
    return envFolderId;
  }

  // 2. Check in-memory cache
  if (cachedDriveFolderId) {
    return cachedDriveFolderId;
  }

  // 3. Search for existing folder
  const existingId = await findFolderByName(ROOT_FOLDER_NAME);
  if (existingId) {
    console.log(`[GoogleSetup] Found existing Drive folder: ${ROOT_FOLDER_NAME} (${existingId})`);
    cachedDriveFolderId = existingId;
    return existingId;
  }

  // 4. Create new folder
  const drive = await getDriveClient();
  const response = await drive.files.create({
    requestBody: {
      name: ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  const newId = response.data.id!;
  console.log(`[GoogleSetup] Created Drive folder: ${ROOT_FOLDER_NAME} (${newId})`);
  cachedDriveFolderId = newId;
  return newId;
}

/**
 * Ensure the Google Spreadsheet exists.
 * If GOOGLE_SHEET_ID is set in env, uses that.
 * Otherwise, searches for or creates the spreadsheet in the root folder.
 */
export async function getOrCreateSpreadsheetId(): Promise<string> {
  // 1. Check env var
  const envSheetId = process.env.GOOGLE_SHEET_ID;
  if (envSheetId) {
    return envSheetId;
  }

  // 2. Check in-memory cache
  if (cachedSpreadsheetId) {
    return cachedSpreadsheetId;
  }

  // 3. Get the root folder first
  const folderId = await getOrCreateDriveFolderId();

  // 4. Search for existing spreadsheet in folder
  const existingId = await findSpreadsheetByName(SPREADSHEET_NAME, folderId);
  if (existingId) {
    console.log(`[GoogleSetup] Found existing Spreadsheet: ${SPREADSHEET_NAME} (${existingId})`);
    cachedSpreadsheetId = existingId;
    return existingId;
  }

  // 5. Create new spreadsheet
  const sheets = await getSheetsClient();
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Produkte';

  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: SPREADSHEET_NAME,
      },
      sheets: [
        {
          properties: {
            title: sheetName,
          },
        },
      ],
    },
  });

  const newId = response.data.spreadsheetId!;
  console.log(`[GoogleSetup] Created Spreadsheet: ${SPREADSHEET_NAME} (${newId})`);

  // Move spreadsheet into root folder
  const drive = await getDriveClient();
  await drive.files.update({
    fileId: newId,
    addParents: folderId,
    fields: 'id, parents',
    supportsAllDrives: true,
  });

  // Initialize headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: newId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [SHEET_HEADERS],
    },
  });

  console.log(`[GoogleSetup] Spreadsheet initialized with headers`);
  cachedSpreadsheetId = newId;
  return newId;
}

/**
 * Get the default sheet name from env or fallback.
 */
export function getDefaultSheetName(): string {
  return process.env.GOOGLE_SHEET_NAME || 'Produkte';
}
