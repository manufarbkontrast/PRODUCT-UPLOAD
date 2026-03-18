import { NextResponse } from 'next/server';
import { isJtlStocksConfigured, refreshCache } from '@/lib/jtl-stocks';

// Allow up to 60s for the initial data load (133MB from Drive)
export const maxDuration = 60;

/**
 * POST /api/jtl-warmup
 * Lädt die JTL-Bestandsdaten aus Google Drive in den Cache.
 * Sollte nach dem Deploy oder bei Cold Start aufgerufen werden.
 */
export async function POST() {
  if (!isJtlStocksConfigured()) {
    return NextResponse.json(
      { error: 'JTL_STOCKS_FOLDER_ID nicht konfiguriert' },
      { status: 500 }
    );
  }

  try {
    const startTime = Date.now();
    await refreshCache();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      message: `JTL-Daten geladen in ${elapsed}s`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Cache-Laden fehlgeschlagen: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }
}
