import { getSheetsClient } from './auth';
import { getOrCreateSpreadsheetId } from './setup';

export interface SheetRow {
  [key: string]: string | number | boolean | null;
}

/**
 * Resolve spreadsheet ID: use provided value or auto-create.
 */
async function resolveSpreadsheetId(id?: string): Promise<string> {
  return id || await getOrCreateSpreadsheetId();
}

/**
 * Read all data from a sheet
 */
export async function readSheet(
  range: string = 'A:Z',
  spreadsheetId?: string
): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const ssId = await resolveSpreadsheetId(spreadsheetId);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: ssId,
    range,
  });

  return response.data.values || [];
}

/**
 * Read data with headers as objects
 */
export async function readSheetAsObjects<T extends SheetRow>(
  range: string = 'A:Z',
  spreadsheetId?: string
): Promise<T[]> {
  const data = await readSheet(range, spreadsheetId);

  if (data.length < 2) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map((row) => {
    const obj: SheetRow = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? null;
    });
    return obj as T;
  });
}

/**
 * Write data to a sheet (append)
 */
export async function appendToSheet(
  values: (string | number | boolean | null)[][],
  range: string = 'A:Z',
  spreadsheetId?: string
): Promise<number> {
  const sheets = await getSheetsClient();
  const ssId = await resolveSpreadsheetId(spreadsheetId);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: ssId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values,
    },
  });

  return response.data.updates?.updatedRows || 0;
}

/**
 * Write data to a specific range (overwrite)
 */
export async function writeToSheet(
  values: (string | number | boolean | null)[][],
  range: string,
  spreadsheetId?: string
): Promise<number> {
  const sheets = await getSheetsClient();
  const ssId = await resolveSpreadsheetId(spreadsheetId);

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: ssId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values,
    },
  });

  return response.data.updatedRows || 0;
}

/**
 * Clear a range in a sheet
 */
export async function clearSheet(
  range: string,
  spreadsheetId?: string
): Promise<void> {
  const sheets = await getSheetsClient();
  const ssId = await resolveSpreadsheetId(spreadsheetId);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: ssId,
    range,
  });
}

/**
 * Get sheet metadata
 */
export async function getSheetInfo(
  spreadsheetId?: string
): Promise<{
  title: string;
  sheets: { title: string; index: number; rowCount: number; columnCount: number }[];
}> {
  const sheets = await getSheetsClient();
  const ssId = await resolveSpreadsheetId(spreadsheetId);

  const response = await sheets.spreadsheets.get({
    spreadsheetId: ssId,
  });

  return {
    title: response.data.properties?.title || '',
    sheets: (response.data.sheets || []).map((sheet) => ({
      title: sheet.properties?.title || '',
      index: sheet.properties?.index || 0,
      rowCount: sheet.properties?.gridProperties?.rowCount || 0,
      columnCount: sheet.properties?.gridProperties?.columnCount || 0,
    })),
  };
}

/**
 * Create a new sheet tab
 */
export async function createSheet(
  title: string,
  spreadsheetId?: string
): Promise<number> {
  const sheets = await getSheetsClient();
  const ssId = await resolveSpreadsheetId(spreadsheetId);

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ssId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title,
            },
          },
        },
      ],
    },
  });

  return response.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;
}

/**
 * Delete a sheet tab
 */
export async function deleteSheet(
  sheetId: number,
  spreadsheetId?: string
): Promise<void> {
  const sheets = await getSheetsClient();
  const ssId = await resolveSpreadsheetId(spreadsheetId);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ssId,
    requestBody: {
      requests: [
        {
          deleteSheet: {
            sheetId,
          },
        },
      ],
    },
  });
}

/**
 * Find row by value in a column
 */
export async function findRowByValue(
  searchValue: string,
  columnIndex: number = 0,
  range: string = 'A:Z',
  spreadsheetId?: string
): Promise<{ rowIndex: number; data: string[] } | null> {
  const data = await readSheet(range, spreadsheetId);

  for (let i = 0; i < data.length; i++) {
    if (data[i][columnIndex] === searchValue) {
      return { rowIndex: i + 1, data: data[i] };
    }
  }

  return null;
}

/**
 * Update a specific row
 */
export async function updateRow(
  rowIndex: number,
  values: (string | number | boolean | null)[],
  sheetName: string = 'Sheet1',
  spreadsheetId?: string
): Promise<number> {
  const range = `${sheetName}!A${rowIndex}`;
  return writeToSheet([values], range, spreadsheetId);
}
