import { NextRequest, NextResponse } from 'next/server';
import {
  findProductByBarcode,
  isShopifyConfigured,
  type ShopifyLookupResult,
} from '@/lib/shopify/client';
import {
  mapToBrandCode,
  mapToGender,
  mapToColor,
  type EanLookupResult,
} from '@/config/ean-lookup-mappings';

/**
 * POST /api/ean-lookup
 * Sucht Produktdaten zu einer EAN/GTIN ausschließlich in Shopify.
 * KEINE Internet-Suche, KEIN Gemini - nur Shopify-Daten.
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

    // Nur Shopify-Suche - keine andere Datenquelle
    if (!isShopifyConfigured()) {
      return NextResponse.json({
        found: false,
        error: 'Shopify ist nicht konfiguriert',
      });
    }

    const shopifyResult = await findProductByBarcode(cleanedEan);

    if (shopifyResult.found) {
      return NextResponse.json(buildShopifyResult(shopifyResult, cleanedEan));
    }

    // Produkt nicht in Shopify gefunden
    return NextResponse.json({
      found: false,
      message: 'Produkt nicht in Shopify gefunden',
    });
  } catch (error) {
    console.error('POST /api/ean-lookup error:', error);
    return NextResponse.json({
      found: false,
      error: 'Fehler bei der Shopify-Suche',
    });
  }
}

// ─── Shopify Result Builder ─────────────────────────────────────────────────

function buildShopifyResult(shopify: ShopifyLookupResult, ean: string): EanLookupResult {
  // Brand-Code mappen
  const brandCode = mapToBrandCode(shopify.brand ?? '');

  // Gender aus Tags oder Produkttyp ableiten
  const genderCode = inferGenderFromShopify(shopify);

  // Farbe mappen
  const colorCode = mapToColor(shopify.color ?? '');

  return {
    found: true,
    source: 'shopify',

    // Basisdaten
    name: shopify.name ?? undefined,
    brand: shopify.brand ?? undefined,
    brandCode: brandCode ?? undefined,

    // Farbe
    color: shopify.color ?? undefined,
    colorCode: colorCode ?? undefined,

    // Gender
    gender: inferGenderLabel(genderCode),
    genderCode: genderCode ?? undefined,

    // Shopify-spezifische Daten
    sku: shopify.sku ?? undefined,
    price: shopify.price ?? undefined,
    compareAtPrice: shopify.compareAtPrice ?? undefined,
    description: shopify.description ?? undefined,
    images: shopify.images ?? undefined,
    size: shopify.size ?? undefined,
    tags: shopify.tags ?? undefined,
    inventoryQuantity: shopify.inventoryQuantity ?? undefined,
    barcode: ean,

    confidence: 'high',
  };
}

/**
 * Leitet das Gender aus Shopify-Daten ab
 */
function inferGenderFromShopify(shopify: ShopifyLookupResult): string | null {
  // Aus Tags suchen (priorisiert)
  if (shopify.tags && shopify.tags.length > 0) {
    for (const tag of shopify.tags) {
      const tagLower = tag.toLowerCase();
      // Exakte Gender-Tags
      if (tagLower === 'herren' || tagLower === 'men' || tagLower === 'male') {
        return 'mann';
      }
      if (tagLower === 'damen' || tagLower === 'women' || tagLower === 'female') {
        return 'frau';
      }
      if (tagLower === 'unisex') {
        return 'unisex';
      }
      if (tagLower === 'kinder' || tagLower === 'kids' || tagLower === 'children') {
        return 'kinder';
      }
    }
  }

  // Aus Produkttyp
  if (shopify.productType) {
    const mapped = mapToGender(shopify.productType);
    if (mapped) return mapped;
  }

  // Aus Produktname - aber vorsichtiger
  if (shopify.name) {
    const nameLower = shopify.name.toLowerCase();

    // Explizite Gender-Keywords
    if (nameLower.includes('herren') || nameLower.includes(' men ') || nameLower.includes('männer')) {
      return 'mann';
    }
    if (nameLower.includes('damen') || nameLower.includes(' women ') || nameLower.includes('frauen')) {
      return 'frau';
    }
    if (nameLower.includes('unisex')) {
      return 'unisex';
    }

    // "Baby" nur als Kinder, wenn nicht Teil von Modebegriffen
    const isBabyFashion = nameLower.includes('baby tee') ||
                          nameLower.includes('baby t-shirt') ||
                          nameLower.includes('babydoll');
    if (!isBabyFashion && (nameLower.includes('kinder') || nameLower.includes('kids'))) {
      return 'kinder';
    }
  }

  return null;
}

/**
 * Wandelt Gender-Code in Label um
 */
function inferGenderLabel(genderCode: string | null): string | undefined {
  const labels: Record<string, string> = {
    'mann': 'Herren',
    'frau': 'Damen',
    'unisex': 'Unisex',
    'kinder': 'Kinder',
  };
  return genderCode ? labels[genderCode] : undefined;
}
