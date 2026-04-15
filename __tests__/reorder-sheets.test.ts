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
      data: { files: [{ id: 'sheet-1', name: 'Nachbestellungen – ACME' }] },
    });
    valuesGet.mockResolvedValueOnce({
      data: {
        values: [
          ['2026-04-14T10:00:00Z', 'SPZ', '4001', 'SKU-1', 'Schuh', '42', '1', ''],
          ['', '', '', '', '', '', '', ''], // simulated cleared row
          ['2026-04-14T11:00:00Z', 'SPR', '4002', 'SKU-2', 'Hose', 'L', '2', 'Eilig'],
        ],
      },
    });

    const rows = await listActiveReorders('ACME');
    expect(rows).toHaveLength(2);
    expect(rows[0].row.sku).toBe('SKU-1');
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].row.sku).toBe('SKU-2');
    expect(rows[1].rowNumber).toBe(4);
  });

  it('finds an active reorder by SKU', async () => {
    driveFilesList.mockResolvedValueOnce({
      data: { files: [{ id: 'sheet-2', name: 'Nachbestellungen – BRAND' }] },
    });
    valuesGet.mockResolvedValueOnce({
      data: {
        values: [
          ['2026-04-14T10:00:00Z', 'SPZ', '4001', 'SKU-A', 'Art', '40', '1', ''],
        ],
      },
    });

    const hit = await findActiveReorderBySku('BRAND', 'SKU-A');
    expect(hit?.row.filiale).toBe('SPZ');

    driveFilesList.mockResolvedValueOnce({
      data: { files: [{ id: 'sheet-2', name: 'Nachbestellungen – BRAND' }] },
    });
    valuesGet.mockResolvedValueOnce({ data: { values: [] } });
    const miss = await findActiveReorderBySku('BRAND2', 'missing');
    expect(miss).toBeNull();
  });
});
