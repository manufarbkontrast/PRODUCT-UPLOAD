import { NextRequest, NextResponse } from 'next/server';
import { findJtlItem, findJtlSiblings, getCacheStatus, type JtlArticle } from '@/lib/jtl/cache';
import { getStockLocationsSupabase, findVariantsSupabase } from '@/lib/jtl-supabase';

/**
 * POST /api/jtl-lookup
 * Sucht Artikel in JTL-Daten (Supabase) mit Lagerbestaenden und Varianten.
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

    if (!result.found || !result.article) {
      return NextResponse.json({
        found: false,
        source: 'jtl',
        cache: getCacheStatus(),
      });
    }

    const article = result.article;
    const kArtikel = parseInt(article.sku ? article.sku : '0', 10);

    // Load stock locations from Supabase
    const stockLocations = await loadStockForArticle(article);

    // Enrich article with stock locations
    const enrichedArticle = {
      ...article,
      stockLocations,
    };

    // Load all variants (siblings) with their stock locations
    let siblings = await findJtlSiblings(article);

    // Enrich each variant with stock locations from Supabase
    const enrichedVariants = await Promise.all(
      siblings.map(async (v) => {
        const variantStock = await loadStockForArticle(v);
        return { ...v, stockLocations: variantStock };
      })
    );

    const totalStock = enrichedVariants.length > 0
      ? enrichedVariants.reduce((sum, s) => sum + s.availableStock, 0)
      : article.availableStock;

    return NextResponse.json({
      found: true,
      source: 'jtl',
      matchField: result.matchField,
      article: enrichedArticle,
      variants: enrichedVariants,
      totalStock,
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
 * Load stock locations for an article from Supabase.
 */
async function loadStockForArticle(article: JtlArticle) {
  try {
    // article ID is stored in the parentItemId or we need to look up by SKU
    // The Supabase data uses k_artikel as primary key
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Find the k_artikel for this SKU
    const { data: artRow } = await sb
      .from('jtl_articles')
      .select('k_artikel')
      .eq('sku', article.sku)
      .limit(1)
      .single();

    if (!artRow) return [];

    const locations = await getStockLocationsSupabase(artRow.k_artikel);
    return locations
      .filter(l => l.bestand !== 0)
      .map(l => ({
        storeNumber: l.lager_name,
        locationName: l.lager_name,
        available: l.bestand,
        total: l.bestand,
      }));
  } catch {
    return [];
  }
}

/**
 * GET /api/jtl-lookup
 * Cache-Status anzeigen.
 */
export async function GET() {
  return NextResponse.json({ cache: getCacheStatus() });
}
