import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';
import { resolveStorageUrl } from '@/lib/supabase/storage-url';
import { validStatuses } from '@/config/product';

function mapProduct(
  p: Record<string, unknown>,
  images?: Record<string, unknown>[],
  supabase?: ReturnType<typeof createServiceRoleClient>
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
  const { error: authError } = await requireUser();
  if (authError) return authError;

  const { id } = await params;

  try {
    const supabase = createServiceRoleClient();

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
  const { error: authError } = await requireUser();
  if (authError) return authError;

  const { id } = await params;

  try {
    const body = await request.json();

    // Validate status against allowed values
    if (body.status !== undefined) {
      const allowed: readonly string[] = validStatuses;
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Ungültiger Status: ${body.status}` },
          { status: 400 }
        );
      }
    }

    // Validate driveUrl format
    if (body.driveUrl !== undefined && body.driveUrl !== null && body.driveUrl !== '') {
      try {
        const parsed = new URL(body.driveUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return NextResponse.json(
            { error: 'driveUrl muss eine HTTP(S)-URL sein' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'driveUrl ist keine gültige URL' },
          { status: 400 }
        );
      }
    }

    const supabase = createServiceRoleClient();

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
  const { error: authError } = await requireUser();
  if (authError) return authError;

  const { id } = await params;

  try {
    const supabase = createServiceRoleClient();

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
