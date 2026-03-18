import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';
import { isShoeCategory } from '@/config/shoe-views';
import { getMissingViews, SHOE_VIEWS } from '@/config/shoe-views';
import { classifyShoeImages, type ClassificationInput } from '@/lib/gemini-classifier';

export const maxDuration = 30;

/**
 * POST /api/products/[id]/classify
 * Klassifiziert Schuhbilder nach Ansichtstyp und sortiert sie in die Standardreihenfolge.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireUser();
  if (authError) return authError;

  const { id } = await params;

  try {
    const supabase = createServiceRoleClient();

    const { data: product, error: productError } = await supabase
      .from('products')
      .select(`
        id, category,
        images:product_images(id, original_path, sort_order)
      `)
      .eq('id', id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    if (!isShoeCategory(product.category)) {
      return NextResponse.json({
        classified: false,
        reason: 'Klassifizierung nur fuer Schuhprodukte',
      });
    }

    if (!product.images || product.images.length === 0) {
      return NextResponse.json({ error: 'Keine Bilder vorhanden' }, { status: 400 });
    }

    // Build image URLs for classification
    const classificationInputs: ClassificationInput[] = product.images.map(
      (img: { id: string; original_path: string }) => {
        const imageUrl = img.original_path.startsWith('http')
          ? img.original_path
          : supabase.storage.from('product-images').getPublicUrl(img.original_path).data.publicUrl;

        return { id: img.id, imageUrl };
      }
    );

    console.log(`[Classify] Starting classification for product ${id} (${classificationInputs.length} images)`);

    const results = await classifyShoeImages(classificationInputs);

    // Update sort_order for each image in DB
    await Promise.all(
      results.map((r) =>
        supabase
          .from('product_images')
          .update({ sort_order: r.sortOrder })
          .eq('id', r.id)
      )
    );

    // Determine missing views
    const assignedSortOrders = results
      .filter((r) => r.sortOrder < SHOE_VIEWS.length)
      .map((r) => r.sortOrder);
    const missing = getMissingViews(assignedSortOrders);

    console.log(`[Classify] Done: ${results.length} classified, ${missing.length} missing views`);

    return NextResponse.json({
      classified: true,
      classifications: results.map((r) => ({
        imageId: r.id,
        viewKey: r.viewKey,
        label: r.label,
        sortOrder: r.sortOrder,
      })),
      missingViews: missing.map((v) => v.key),
      missingLabels: missing.map((v) => v.label),
    });
  } catch (error) {
    console.error(`POST /api/products/${id}/classify error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Klassifizierung fehlgeschlagen' },
      { status: 500 }
    );
  }
}
