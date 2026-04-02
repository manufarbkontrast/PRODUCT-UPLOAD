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

    // Load stock locations from Supabase
    const stockLocations = await loadStockForArticle(article);

    // Load article name from Supabase
    const artikelName = await loadArticleName(article.sku);

    // Enrich article with stock locations and name
    const enrichedArticle = {
      ...article,
      name: artikelName || article.name || article.sku,
      stockLocations,
    };

    // Load all variants (siblings) directly from Supabase by vater_artikel_id
    const enrichedVariants = await loadVariantsWithStock(article);

    const totalStock = enrichedVariants.length > 0
      ? enrichedVariants.reduce((sum, s) => sum + (s.availableStock ?? 0), 0)
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
 * Load article name from Supabase.
 */
async function loadArticleName(sku: string): Promise<string | null> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data } = await sb
      .from('jtl_articles')
      .select('artikel_name')
      .eq('sku', sku)
      .limit(1)
      .single();
    return data?.artikel_name || null;
  } catch {
    return null;
  }
}

/**
 * Load all variants with stock locations from Supabase.
 */
async function loadVariantsWithStock(article: JtlArticle) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Find k_artikel for this SKU to get vater_artikel_id
    const { data: artRow } = await sb
      .from('jtl_articles')
      .select('k_artikel, vater_artikel_id, artikel_name')
      .eq('sku', article.sku)
      .limit(1)
      .single();

    if (!artRow) return [];

    const vaterId = artRow.vater_artikel_id || artRow.k_artikel;

    // Find all siblings
    const { data: siblings } = await sb
      .from('jtl_articles')
      .select('*')
      .eq('vater_artikel_id', vaterId)
      .order('sku');

    if (!siblings || siblings.length === 0) return [];

    // Load stock locations for all siblings
    const siblingIds = siblings.map(s => s.k_artikel);
    const { data: allStock } = await sb
      .from('jtl_stock_locations')
      .select('*')
      .in('k_artikel', siblingIds);

    const stockMap = new Map<number, Array<{ locationName: string; available: number }>>();
    for (const s of allStock || []) {
      if (s.bestand === 0) continue;
      const existing = stockMap.get(s.k_artikel) || [];
      existing.push({ locationName: s.lager_name, available: s.bestand });
      stockMap.set(s.k_artikel, existing);
    }

    return siblings.map(s => ({
      sku: s.sku,
      name: s.artikel_name || s.sku,
      description: '',
      gtin: s.barcode || '',
      ownIdentifier: '',
      manufacturerNumber: '',
      salesPriceNet: s.vk_netto || 0,
      suggestedRetailPrice: s.uvp || 0,
      purchasePriceNet: s.ek_letzter || s.ek_netto || 0,
      categories: s.warengruppe || '',
      isActive: s.aktiv,
      parentItemId: String(vaterId),
      countryOfOrigin: '',
      zalandoPrice: '',
      availableStock: s.verfuegbar || 0,
      totalStock: s.bestand || 0,
      stockLocations: (stockMap.get(s.k_artikel) || []).map(l => ({
        storeNumber: l.locationName,
        locationName: l.locationName,
        available: l.available,
        total: l.available,
      })),
    }));
  } catch (error) {
    console.error('[jtl-lookup] loadVariantsWithStock error:', error);
    return [];
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
