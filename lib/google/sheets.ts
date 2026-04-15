import { google, type sheets_v4 } from 'googleapis';
import { getOAuth2Client, loadSavedTokens, getDriveClient } from './auth';

/**
 * Google Sheets client for reorder sheets.
 * Prefers OAuth2 (same tokens as Drive). Requires the `spreadsheets` scope —
 * re-authorize via /api/google/auth if scope was added after initial auth.
 */

const SHEET_HEADER: readonly string[] = [
  'Timestamp',
  'Filiale',
  'EAN',
  'SKU',
  'Artikelname',
  'Größe',
  'Menge',
  'Notiz',
] as const;

export const REORDER_COLUMNS = SHEET_HEADER.length;

export interface ReorderRow {
  readonly timestamp: string;
  readonly filiale: string;
  readonly ean: string;
  readonly sku: string;
  readonly articleName: string;
  readonly size: string;
  readonly quantity: string;
  readonly note: string;
}

export interface ActiveReorder {
  readonly rowNumber: number; // 1-based, header is row 1
  readonly row: ReorderRow;
}

function getFolderId(): string {
  const id = process.env.REORDER_SHEETS_FOLDER_ID?.trim();
  if (!id) {
    throw new Error('REORDER_SHEETS_FOLDER_ID is not configured');
  }
  return id;
}

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const tokens = loadSavedTokens();
  if (!tokens || !tokens.refresh_token) {
    throw new Error(
      'OAuth2 tokens not available for Sheets. Re-authorize via /api/google/auth.'
    );
  }
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

function sheetTitleForBrand(brand: string): string {
  return `Nachbestellungen – ${brand}`;
}

/**
 * Cache brand → spreadsheetId per server invocation.
 * On Vercel each cold start gets a fresh cache, which is fine.
 */
const brandSheetCache = new Map<string, string>();

async function findSheetIdInFolder(brand: string): Promise<string | null> {
  const title = sheetTitleForBrand(brand);
  const drive = await getDriveClient();
  const folderId = getFolderId();
  const res = await drive.files.list({
    q: [
      `'${folderId}' in parents`,
      `name = '${title.replace(/'/g, "\\'")}'`,
      "mimeType = 'application/vnd.google-apps.spreadsheet'",
      'trashed = false',
    ].join(' and '),
    fields: 'files(id, name)',
    pageSize: 1,
  });
  const file = res.data.files?.[0];
  return file?.id ?? null;
}

async function createBrandSheet(brand: string): Promise<string> {
  const sheets = await getSheetsClient();
  const drive = await getDriveClient();
  const folderId = getFolderId();

  const create = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: sheetTitleForBrand(brand) },
      sheets: [{ properties: { title: 'Nachbestellungen' } }],
    },
  });
  const spreadsheetId = create.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Failed to create reorder spreadsheet');
  }

  // Move the new spreadsheet into the configured folder.
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: folderId,
    removeParents: 'root',
    fields: 'id, parents',
  });

  // Write header row.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Nachbestellungen!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [SHEET_HEADER.slice()] },
  });

  return spreadsheetId;
}

export async function getOrCreateSheetByBrand(brand: string): Promise<string> {
  const cached = brandSheetCache.get(brand);
  if (cached) return cached;

  const existing = await findSheetIdInFolder(brand);
  if (existing) {
    brandSheetCache.set(brand, existing);
    return existing;
  }

  const created = await createBrandSheet(brand);
  brandSheetCache.set(brand, created);
  return created;
}

function rowToReorder(row: readonly string[]): ReorderRow {
  const cell = (i: number): string => (row[i] ?? '').toString();
  return {
    timestamp: cell(0),
    filiale: cell(1),
    ean: cell(2),
    sku: cell(3),
    articleName: cell(4),
    size: cell(5),
    quantity: cell(6),
    note: cell(7),
  };
}

/**
 * List all reorder rows currently in the sheet for the given brand.
 * Returns [] when the sheet is empty (only header or missing).
 */
export async function listActiveReorders(brand: string): Promise<readonly ActiveReorder[]> {
  const spreadsheetId = await getOrCreateSheetByBrand(brand);
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Nachbestellungen!A2:H',
    majorDimension: 'ROWS',
  });
  const values = res.data.values ?? [];
  return values
    .map((row, idx) => {
      const reorder = rowToReorder(row as readonly string[]);
      // Skip empty rows (deleted via "clear contents")
      const isEmpty = !reorder.sku && !reorder.ean;
      if (isEmpty) return null;
      return { rowNumber: idx + 2, row: reorder };
    })
    .filter((x): x is ActiveReorder => x !== null);
}

export async function findActiveReorderBySku(
  brand: string,
  sku: string
): Promise<ActiveReorder | null> {
  const all = await listActiveReorders(brand);
  return all.find((r) => r.row.sku === sku) ?? null;
}

export async function appendReorder(
  brand: string,
  row: ReorderRow
): Promise<void> {
  const spreadsheetId = await getOrCreateSheetByBrand(brand);
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Nachbestellungen!A:H',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        row.timestamp,
        row.filiale,
        row.ean,
        row.sku,
        row.articleName,
        row.size,
        row.quantity,
        row.note,
      ]],
    },
  });
}

/**
 * Delete a specific row by 1-based row number.
 * Used to roll back on race-condition conflict.
 */
export async function deleteReorderRow(
  brand: string,
  rowNumber: number
): Promise<void> {
  const spreadsheetId = await getOrCreateSheetByBrand(brand);
  const sheets = await getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === 'Nachbestellungen'
  );
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error('Tab "Nachbestellungen" not found');
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1, // 0-based, exclusive end
            endIndex: rowNumber,
          },
        },
      }],
    },
  });
}
