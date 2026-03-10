import { NextRequest, NextResponse } from 'next/server';
import {
  findProductInventory,
  isShopifyConfigured,
} from '@/lib/shopify/client';

/**
 * POST /api/inventory-lookup
 * Holt alle Varianten eines Produkts mit Lagerbestaenden pro Standort.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ean } = body;

    if (!ean || typeof ean !== 'string') {
      return NextResponse.json(
        { error: 'EAN ist erforderlich' },
        { status: 400 }
      );
    }

    const cleanedEan = ean.replace(/\D/g, '').trim();

    if (!isShopifyConfigured()) {
      return NextResponse.json({
        found: false,
        error: 'Shopify ist nicht konfiguriert',
      });
    }

    const result = await findProductInventory(cleanedEan);

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/inventory-lookup error:', error);
    return NextResponse.json({
      found: false,
      error: 'Fehler bei der Bestandsabfrage',
    });
  }
}
