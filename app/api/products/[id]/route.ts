import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

function resolveStorageUrl(
  supabase: ReturnType<typeof createServerClient>,
  path: unknown,
  bucket: string
): string | null {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http')) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function mapProduct(
  p: Record<string, unknown>,
  images?: Record<string, unknown>[],
  supabase?: ReturnType<typeof createServerClient>
) {
  return {
    id: p.id,
    ean: p.ean,
    name: p.name,
    gender: p.gender,
    category: p.category,
    description: p.description,
    sku: p.sku,
    status: p.status,
    driveUrl: p.drive_url,
    zalandoAttributes: p.zalando_attributes,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    images: (images || []).map(img => ({
      id: img.id,
      filename: img.filename,
      originalPath: supabase
        ? resolveStorageUrl(supabase, img.original_path, 'product-images')
        : img.original_path,
      processedPath: supabase
        ? resolveStorageUrl(supabase, img.processed_path, 'processed-images')
        : img.processed_path,
      status: img.status,
      sortOrder: img.sort_order,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServerClient();

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        images:product_images(id, filename, original_path, processed_path, status, sort_order)
      `)
      .eq('id', id)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json(mapProduct(product, product.images, supabase));
  } catch (error) {
    console.error(`GET /api/products/${id} error:`, error);
    return NextResponse.json({ error: 'Fehler beim Laden des Produkts' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const supabase = createServerClient();

    // Map camelCase to snake_case for Supabase
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.ean !== undefined) updateData.ean = body.ean;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.driveUrl !== undefined) updateData.drive_url = body.driveUrl;
    if (body.zalandoAttributes !== undefined) updateData.zalando_attributes = body.zalandoAttributes;

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(mapProduct(product));
  } catch (error) {
    console.error(`PATCH /api/products/${id} error:`, error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Produkts' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServerClient();

    // Delete product images from storage
    const { data: images } = await supabase
      .from('product_images')
      .select('original_path, processed_path')
      .eq('product_id', id);

    if (images) {
      const originalPaths = images.map(img => img.original_path).filter(Boolean);
      const processedPaths = images.map(img => img.processed_path).filter(Boolean);

      if (originalPaths.length > 0) {
        await supabase.storage.from('product-images').remove(originalPaths);
      }
      if (processedPaths.length > 0) {
        await supabase.storage.from('processed-images').remove(processedPaths);
      }
    }

    // Delete product (cascades to images via FK)
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/products/${id} error:`, error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Produkts' }, { status: 500 });
  }
}
