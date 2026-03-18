import { NextRequest, NextResponse } from 'next/server';
import {
  mapToColor,
  type EanLookupResult,
} from '@/config/ean-lookup-mappings';
import {
  findByEan,
  findVariants,
  extractSizeFromSku,
  extractColorFromName,
  isJtlStocksConfigured,
  type JtlStockItem,
} from '@/lib/jtl-stocks';

/**
 * POST /api/ean-lookup
 * Sucht Produktdaten zu einer EAN/GTIN in den JTL-Bestandsdaten (Google Drive).
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

    const cleanedEan = ean.trim();

    if (!isJtlStocksConfigured()) {
      return NextResponse.json({
        found: false,
        error: 'JTL-Bestandsdaten nicht konfiguriert (JTL_STOCKS_FOLDER_ID fehlt)',
      });
    }

    const jtlItems = await findByEan(cleanedEan);
    if (jtlItems.length === 0) {
      return NextResponse.json({
        found: false,
        message: 'Produkt nicht in JTL-Bestandsdaten gefunden',
      });
    }

    const result = await buildJtlResult(jtlItems, cleanedEan);
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/ean-lookup error:', error);
    return NextResponse.json({
      found: false,
      error: 'Fehler bei der Artikelsuche',
    });
  }
}

// ─── JTL Result Builder ─────────────────────────────────────────────────────

async function buildJtlResult(items: JtlStockItem[], ean: string): Promise<EanLookupResult> {
  // Prefer active item, prefer shoesplease store
  const sorted = [...items].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.storeNumber === 'shoesplease' && b.storeNumber !== 'shoesplease') return -1;
    if (b.storeNumber === 'shoesplease' && a.storeNumber !== 'shoesplease') return 1;
    return 0;
  });

  const item = sorted[0];

  // Extract size from SKU
  const size = extractSizeFromSku(item.sku);

  // Extract color from name
  const color = extractColorFromName(item.name);
  const colorCode = mapToColor(color);

  // Infer category from JTL categories string
  const category = inferCategoryFromJtl(item.categories);

  // Get all variants (siblings via parent ID) for stock overview
  let variants: JtlStockItem[] = [];
  if (item.parentItemId) {
    variants = await findVariants(item.parentItemId);
  }

  // Calculate total available stock across all stores for this EAN
  const totalAvailable = items.reduce((sum, i) => sum + i.availableStock, 0);

  // Price: use suggested retail price (VK), fallback to net price
  const price = item.suggestedRetailPrice > 0
    ? item.suggestedRetailPrice.toFixed(2)
    : item.priceNet > 0
      ? (item.priceNet * 1.19).toFixed(2) // Net → Brutto (19% MwSt)
      : undefined;

  return {
    found: true,
    source: 'jtl',

    name: item.name,
    sku: item.sku,
    barcode: ean,

    color: color || undefined,
    colorCode: colorCode ?? undefined,

    size: size || undefined,

    price,

    silhouette: category ?? undefined,

    inventoryQuantity: totalAvailable,

    brand: item.storeNumber === 'shoesplease' ? 'Shoesplease' : 'Jeans&Co',

    variants: variants
      .filter(v => v.isActive)
      .map(v => ({
        sku: v.sku,
        size: extractSizeFromSku(v.sku),
        stock: v.availableStock,
        ean: v.ean,
      }))
      .sort((a, b) => {
        const sizeA = parseFloat(a.size) || 0;
        const sizeB = parseFloat(b.size) || 0;
        return sizeA - sizeB;
      }),

    confidence: 'high',
  };
}

/**
 * Extract category from JTL categories string.
 * e.g. "[{'CategoryId': 232, 'Name': 'Shopify Shoesplease->Schuhe'}]" → "Schuhe"
 */
function inferCategoryFromJtl(categories: string): string | null {
  if (!categories) return null;

  const nameMatches = categories.match(/Name':\s*'([^']+)'/g);
  if (!nameMatches) return null;

  for (const match of nameMatches) {
    const nameValue = match.match(/Name':\s*'([^']+)'/)?.[1] ?? '';
    const segments = nameValue.split('->');
    const lastSegment = segments[segments.length - 1]?.trim();
    if (lastSegment && lastSegment !== 'Shopify - nur POS') {
      return lastSegment;
    }
  }

  return null;
}
