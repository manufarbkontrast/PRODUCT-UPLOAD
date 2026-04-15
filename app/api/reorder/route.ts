import { NextRequest, NextResponse } from 'next/server';
import { requireFiliale } from '@/lib/auth/require-filiale';
import {
  appendReorder,
  deleteReorderRow,
  findActiveReorderBySku,
  listActiveReorders,
} from '@/lib/google/sheets';

interface ReorderItem {
  readonly sku: string;
  readonly ean: string;
  readonly articleName: string;
  readonly size: string;
  readonly quantity: string;
}

interface ReorderBody {
  readonly brand?: unknown;
  readonly note?: unknown;
  readonly items?: unknown;
  // Legacy single-item fields (still supported for backwards compatibility)
  readonly sku?: unknown;
  readonly ean?: unknown;
  readonly articleName?: unknown;
  readonly size?: unknown;
  readonly quantity?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseItems(body: ReorderBody): ReorderItem[] {
  if (Array.isArray(body.items) && body.items.length > 0) {
    return body.items
      .map((raw): ReorderItem | null => {
        if (!raw || typeof raw !== 'object') return null;
        const r = raw as Record<string, unknown>;
        const sku = asString(r.sku);
        if (!sku) return null;
        return {
          sku,
          ean: asString(r.ean),
          articleName: asString(r.articleName),
          size: asString(r.size),
          quantity: asString(r.quantity) || '1',
        };
      })
      .filter((x): x is ReorderItem => x !== null);
  }
  // Legacy single-item body
  const sku = asString(body.sku);
  if (!sku) return [];
  return [{
    sku,
    ean: asString(body.ean),
    articleName: asString(body.articleName),
    size: asString(body.size),
    quantity: asString(body.quantity) || '1',
  }];
}

type ItemResult =
  | { readonly sku: string; readonly ok: true; readonly timestamp: string }
  | { readonly sku: string; readonly ok: false; readonly locked: true; readonly filiale: string; readonly timestamp: string }
  | { readonly sku: string; readonly ok: false; readonly error: string };

/**
 * POST /api/reorder
 * Body: { brand, note?, items: [{sku, ean, articleName, size, quantity}] }
 * Legacy: { brand, sku, ean, articleName, size, quantity, note }
 *
 * Schreibt pro Item eine Zeile in das globale Sheet. Sperrt pro SKU
 * (marken-uebergreifend). 409 wenn KEINE Zeile erfolgreich gebucht wurde.
 */
export async function POST(request: NextRequest) {
  const auth = await requireFiliale();
  if (auth.error) return auth.error;
  const { filiale } = auth;

  let body: ReorderBody;
  try {
    body = (await request.json()) as ReorderBody;
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const brand = asString(body.brand);
  const note = asString(body.note);
  const items = parseItems(body);

  if (!brand || items.length === 0) {
    return NextResponse.json(
      { error: 'brand und mindestens ein Item sind erforderlich' },
      { status: 400 }
    );
  }

  const results: ItemResult[] = [];

  for (const item of items) {
    try {
      const existing = await findActiveReorderBySku(item.sku);
      if (existing) {
        results.push({
          sku: item.sku,
          ok: false,
          locked: true,
          filiale: existing.row.filiale,
          timestamp: existing.row.timestamp,
        });
        continue;
      }

      const timestamp = new Date().toISOString();
      await appendReorder({
        timestamp,
        filiale,
        brand,
        ean: item.ean,
        sku: item.sku,
        articleName: item.articleName,
        size: item.size,
        quantity: item.quantity,
        note,
      });

      // Race-Guard: mehrfach-Zeilen nach Append bereinigen
      const after = await listActiveReorders();
      const matches = after.filter((r) => r.row.sku === item.sku);
      if (matches.length > 1) {
        const oursLatest = matches.reduce((acc, cur) =>
          cur.row.timestamp > acc.row.timestamp ? cur : acc
        );
        const winner = matches.find((r) => r !== oursLatest);
        if (oursLatest.row.timestamp === timestamp && oursLatest.row.filiale === filiale) {
          try {
            await deleteReorderRow(oursLatest.rowNumber);
          } catch (cleanupErr) {
            console.error('[reorder] cleanup failed', cleanupErr);
          }
          results.push({
            sku: item.sku,
            ok: false,
            locked: true,
            filiale: winner?.row.filiale ?? '?',
            timestamp: winner?.row.timestamp ?? '',
          });
          continue;
        }
      }

      results.push({ sku: item.sku, ok: true, timestamp });
    } catch (err) {
      console.error(`[reorder] failed for ${item.sku}:`, err);
      results.push({
        sku: item.sku,
        ok: false,
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    }
  }

  const success = results.filter((r) => r.ok).length;
  const locked = results.filter((r) => !r.ok && 'locked' in r && r.locked).length;
  const errored = results.filter((r) => !r.ok && 'error' in r).length;
  const status = success > 0 ? 200 : locked > 0 ? 409 : 500;

  return NextResponse.json(
    {
      ok: success > 0,
      filiale,
      results,
      summary: { total: results.length, success, locked, error: errored },
    },
    { status }
  );
}

/**
 * GET /api/reorder?sku=...
 * Einzel-SKU: { locked, filiale?, timestamp? }
 *
 * GET /api/reorder?skus=sku1,sku2,sku3
 * Mehrere SKUs: { locks: { [sku]: { locked, filiale?, timestamp? } } }
 */
export async function GET(request: NextRequest) {
  const auth = await requireFiliale();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const sku = (searchParams.get('sku') ?? '').trim();
  const skusParam = (searchParams.get('skus') ?? '').trim();

  if (!sku && !skusParam) {
    return NextResponse.json(
      { error: 'sku oder skus ist erforderlich' },
      { status: 400 }
    );
  }

  try {
    if (skusParam) {
      const skus = skusParam.split(',').map((s) => s.trim()).filter(Boolean);
      const all = await listActiveReorders();
      const locks: Record<string, { locked: boolean; filiale?: string; timestamp?: string }> = {};
      for (const s of skus) {
        const hit = all.find((r) => r.row.sku === s);
        locks[s] = hit
          ? { locked: true, filiale: hit.row.filiale, timestamp: hit.row.timestamp }
          : { locked: false };
      }
      return NextResponse.json({ locks });
    }

    const existing = await findActiveReorderBySku(sku);
    if (!existing) {
      return NextResponse.json({ locked: false });
    }
    return NextResponse.json({
      locked: true,
      filiale: existing.row.filiale,
      timestamp: existing.row.timestamp,
    });
  } catch (err) {
    console.error('GET /api/reorder error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Fehler beim Status-Check',
      },
      { status: 500 }
    );
  }
}
