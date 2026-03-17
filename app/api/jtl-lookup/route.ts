import { NextRequest, NextResponse } from 'next/server';
import { findJtlItem, findJtlSiblings, getCacheStatus } from '@/lib/jtl/cache';

/**
 * POST /api/jtl-lookup
 * Sucht Artikel in der JTL-Stammdaten CSV (cached von Google Drive).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ean } = body;

    if (!ean || typeof ean !== 'string') {
      return NextResponse.json(
        { error: 'EAN/Artikelnummer ist erforderlich' },
        { status: 400 }
      );
    }

    const query = ean.trim();
    if (query.length < 3) {
      return NextResponse.json(
        { error: 'Mindestens 3 Zeichen erforderlich' },
        { status: 400 }
      );
    }

    const result = await findJtlItem(query);

    if (!result.found || !result.item) {
      return NextResponse.json({
        found: false,
        source: 'jtl',
        cache: getCacheStatus(),
      });
    }

    // Alle Varianten (Geschwister) laden
    const siblings = await findJtlSiblings(result.item);

    return NextResponse.json({
      found: true,
      source: 'jtl',
      matchField: result.matchField,
      item: result.item,
      variants: siblings,
      totalStock: siblings.reduce((sum, s) => sum + s.availableStock, 0),
      cache: getCacheStatus(),
    });
  } catch (error) {
    console.error('POST /api/jtl-lookup error:', error);
    return NextResponse.json({
      found: false,
      error: error instanceof Error ? error.message : 'Fehler bei der JTL-Suche',
    }, { status: 500 });
  }
}

/**
 * GET /api/jtl-lookup
 * Cache-Status anzeigen.
 */
export async function GET() {
  return NextResponse.json({ cache: getCacheStatus() });
}
