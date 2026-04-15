import { NextRequest, NextResponse } from 'next/server';
import { requireFiliale } from '@/lib/auth/require-filiale';
import {
  appendReorder,
  deleteReorderRow,
  findActiveReorderBySku,
  listActiveReorders,
} from '@/lib/google/sheets';

interface ReorderBody {
  readonly ean?: unknown;
  readonly sku?: unknown;
  readonly articleName?: unknown;
  readonly brand?: unknown;
  readonly size?: unknown;
  readonly quantity?: unknown;
  readonly note?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * POST /api/reorder
 * Hängt eine Nachbestellung an das Marken-Sheet an.
 * 409 wenn für die SKU bereits eine offene Zeile existiert.
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

  const sku = asString(body.sku);
  const brand = asString(body.brand);
  const ean = asString(body.ean);
  const articleName = asString(body.articleName);
  const size = asString(body.size);
  const quantity = asString(body.quantity) || '1';
  const note = asString(body.note);

  if (!sku || !brand) {
    return NextResponse.json(
      { error: 'sku und brand sind erforderlich' },
      { status: 400 }
    );
  }

  try {
    // Pre-check: is the SKU already locked by another filiale?
    const existing = await findActiveReorderBySku(brand, sku);
    if (existing) {
      return NextResponse.json(
        {
          error: 'Bereits nachbestellt',
          filiale: existing.row.filiale,
          timestamp: existing.row.timestamp,
        },
        { status: 409 }
      );
    }

    const timestamp = new Date().toISOString();
    await appendReorder(brand, {
      timestamp,
      filiale,
      ean,
      sku,
      articleName,
      size,
      quantity,
      note,
    });

    // Race-condition guard: re-read and ensure our row is the only one for this SKU.
    // If another filiale slipped in between our pre-check and append, delete our newer row.
    const after = await listActiveReorders(brand);
    const matches = after.filter((r) => r.row.sku === sku);
    if (matches.length > 1) {
      const oursLatest = matches.reduce((acc, cur) =>
        cur.row.timestamp > acc.row.timestamp ? cur : acc
      );
      const winner = matches.find((r) => r !== oursLatest);
      if (oursLatest.row.timestamp === timestamp && oursLatest.row.filiale === filiale) {
        try {
          await deleteReorderRow(brand, oursLatest.rowNumber);
        } catch (cleanupErr) {
          console.error('[reorder] cleanup failed', cleanupErr);
        }
        return NextResponse.json(
          {
            error: 'Bereits nachbestellt',
            filiale: winner?.row.filiale,
            timestamp: winner?.row.timestamp,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ ok: true, timestamp, filiale });
  } catch (err) {
    console.error('POST /api/reorder error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Fehler beim Nachbestellen',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reorder?brand=…&sku=…
 * Status-Check ob SKU bereits nachbestellt wurde.
 */
export async function GET(request: NextRequest) {
  const auth = await requireFiliale();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const brand = (searchParams.get('brand') ?? '').trim();
  const sku = (searchParams.get('sku') ?? '').trim();

  if (!brand || !sku) {
    return NextResponse.json(
      { error: 'brand und sku sind erforderlich' },
      { status: 400 }
    );
  }

  try {
    const existing = await findActiveReorderBySku(brand, sku);
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
