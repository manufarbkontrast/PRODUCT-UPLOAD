import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock googleapis + auth before importing sheets helpers.
const valuesGet = vi.fn();
const valuesAppend = vi.fn();
const valuesUpdate = vi.fn();
const spreadsheetsCreate = vi.fn();
const spreadsheetsGet = vi.fn();
const batchUpdate = vi.fn();
const driveFilesList = vi.fn();
const driveFilesUpdate = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    sheets: () => ({
      spreadsheets: {
        create: spreadsheetsCreate,
        get: spreadsheetsGet,
        batchUpdate,
        values: {
          get: valuesGet,
          append: valuesAppend,
          update: valuesUpdate,
        },
      },
    }),
  },
}));

vi.mock('@/lib/google/auth', () => ({
  getOAuth2Client: () => ({ setCredentials: vi.fn() }),
  loadSavedTokens: () => ({ refresh_token: 'fake', access_token: 'x' }),
  getDriveClient: async () => ({
    files: { list: driveFilesList, update: driveFilesUpdate },
  }),
}));

import {
  listActiveReorders,
  findActiveReorderBySku,
} from '@/lib/google/sheets';

describe('sheets helpers', () => {
  beforeEach(() => {
    process.env.REORDER_SHEETS_FOLDER_ID = 'folder-123';
    valuesGet.mockReset();
    valuesAppend.mockReset();
    valuesUpdate.mockReset();
    spreadsheetsCreate.mockReset();
    spreadsheetsGet.mockReset();
    batchUpdate.mockReset();
    driveFilesList.mockReset();
    driveFilesUpdate.mockReset();
  });

  it('lists active reorders, skipping empty rows', async () => {
    driveFilesList.mockResolvedValueOnce({
      data: { files: [{ id: 'sheet-1', name: 'SPZ Nachbestellungen' }] },
    });
    valuesGet.mockResolvedValueOnce({
      data: {
        values: [
          ['2026-04-14T10:00:00Z', 'SPZ', 'ACME', '4001', 'SKU-1', 'Schuh', '42', '1', ''],
          ['', '', '', '', '', '', '', '', ''],
          ['2026-04-14T11:00:00Z', 'SPR', 'BRAND', '4002', 'SKU-2', 'Hose', 'L', '2', 'Eilig'],
        ],
      },
    });

    const rows = await listActiveReorders();
    expect(rows).toHaveLength(2);
    expect(rows[0].row.sku).toBe('SKU-1');
    expect(rows[0].row.brand).toBe('ACME');
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].row.sku).toBe('SKU-2');
    expect(rows[1].row.brand).toBe('BRAND');
    expect(rows[1].rowNumber).toBe(4);
  });

  it('finds an active reorder by SKU regardless of brand', async () => {
    driveFilesList.mockResolvedValueOnce({
      data: { files: [{ id: 'sheet-2', name: 'SPZ Nachbestellungen' }] },
    });
    valuesGet.mockResolvedValueOnce({
      data: {
        values: [
          ['2026-04-14T10:00:00Z', 'SPZ', 'BRAND', '4001', 'SKU-A', 'Art', '40', '1', ''],
        ],
      },
    });

    const hit = await findActiveReorderBySku('SKU-A');
    expect(hit?.row.filiale).toBe('SPZ');
    expect(hit?.row.brand).toBe('BRAND');

    driveFilesList.mockResolvedValueOnce({
      data: { files: [{ id: 'sheet-2', name: 'SPZ Nachbestellungen' }] },
    });
    valuesGet.mockResolvedValueOnce({ data: { values: [] } });
    const miss = await findActiveReorderBySku('missing');
    expect(miss).toBeNull();
  });
});
