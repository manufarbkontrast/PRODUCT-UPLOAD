import { google, type sheets_v4 } from 'googleapis';
import { getOAuth2Client, loadSavedTokens, getDriveClient } from './auth';

/**
 * Google Sheets client for the single global reorder sheet.
 * Requires the `spreadsheets` scope (re-authorize via /api/google/auth if needed).
 */

const SHEET_TITLE = 'SPZ Nachbestellungen';
const TAB_NAME = 'Nachbestellungen';

const SHEET_HEADER: readonly string[] = [
  'Timestamp',
  'Filiale',
  'Marke',
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
  readonly brand: string;
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

/**
 * Cache the single spreadsheet ID per invocation.
 * Each cold start re-resolves via Drive API (cheap, still single sheet).
 */
let sheetIdCache: string | null = null;

async function findSheetInFolder(): Promise<string | null> {
  const drive = await getDriveClient();
  const folderId = getFolderId();
  const res = await drive.files.list({
    q: [
      `'${folderId}' in parents`,
      `name = '${SHEET_TITLE.replace(/'/g, "\\'")}'`,
      "mimeType = 'application/vnd.google-apps.spreadsheet'",
      'trashed = false',
    ].join(' and '),
    fields: 'files(id, name)',
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createSheet(): Promise<string> {
  const sheets = await getSheetsClient();
  const drive = await getDriveClient();
  const folderId = getFolderId();

  const create = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: TAB_NAME } }],
    },
  });
  const spreadsheetId = create.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Failed to create reorder spreadsheet');
  }

  await drive.files.update({
    fileId: spreadsheetId,
    addParents: folderId,
    removeParents: 'root',
    fields: 'id, parents',
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB_NAME}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [SHEET_HEADER.slice()] },
  });

  return spreadsheetId;
}

export async function getOrCreateReorderSheet(): Promise<string> {
  if (sheetIdCache) return sheetIdCache;

  const existing = await findSheetInFolder();
  if (existing) {
    sheetIdCache = existing;
    return existing;
  }

  const created = await createSheet();
  sheetIdCache = created;
  return created;
}

function rowToReorder(row: readonly string[]): ReorderRow {
  const cell = (i: number): string => (row[i] ?? '').toString();
  return {
    timestamp: cell(0),
    filiale: cell(1),
    brand: cell(2),
    ean: cell(3),
    sku: cell(4),
    articleName: cell(5),
    size: cell(6),
    quantity: cell(7),
    note: cell(8),
  };
}

/**
 * List all rows currently in the sheet. Returns [] when sheet is empty.
 * Empty rows (all columns blank) are filtered out so deleting contents
 * of a row via "clear" in the UI releases the SKU lock.
 */
export async function listActiveReorders(): Promise<readonly ActiveReorder[]> {
  const spreadsheetId = await getOrCreateReorderSheet();
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB_NAME}!A2:I`,
    majorDimension: 'ROWS',
  });
  const values = res.data.values ?? [];
  return values
    .map((row, idx) => {
      const reorder = rowToReorder(row as readonly string[]);
      const isEmpty = !reorder.sku && !reorder.ean;
      if (isEmpty) return null;
      return { rowNumber: idx + 2, row: reorder };
    })
    .filter((x): x is ActiveReorder => x !== null);
}

export async function findActiveReorderBySku(
  sku: string
): Promise<ActiveReorder | null> {
  const all = await listActiveReorders();
  return all.find((r) => r.row.sku === sku) ?? null;
}

export async function appendReorder(row: ReorderRow): Promise<void> {
  const spreadsheetId = await getOrCreateReorderSheet();
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TAB_NAME}!A:I`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        row.timestamp,
        row.filiale,
        row.brand,
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
export async function deleteReorderRow(rowNumber: number): Promise<void> {
  const spreadsheetId = await getOrCreateReorderSheet();
  const sheets = await getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === TAB_NAME
  );
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Tab "${TAB_NAME}" not found`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      }],
    },
  });
}
