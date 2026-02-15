import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServiceRoleClient();

    // Check if product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const replaceExisting = formData.get('replace') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Nur Bilder erlaubt' }, { status: 400 });
    }

    // If replace flag is set, delete all existing images for this product first
    if (replaceExisting) {
      const { data: existingImages } = await supabase
        .from('product_images')
        .select('id, original_path, processed_path')
        .eq('product_id', id);

      if (existingImages && existingImages.length > 0) {
        console.log(`[Images] Replacing ${existingImages.length} existing images for product ${id}`);

        // Delete from storage
        const originalPaths = existingImages
          .map((img) => {
            if (!img.original_path) return null;
            return img.original_path.includes('/product-images/')
              ? img.original_path.split('/product-images/').pop()!
              : img.original_path;
          })
          .filter(Boolean) as string[];

        const processedPaths = existingImages
          .map((img) => {
            if (!img.processed_path) return null;
            return img.processed_path.includes('/processed-images/')
              ? img.processed_path.split('/processed-images/').pop()!
              : img.processed_path;
          })
          .filter(Boolean) as string[];

        if (originalPaths.length > 0) {
          await supabase.storage.from('product-images').remove(originalPaths);
        }
        if (processedPaths.length > 0) {
          await supabase.storage.from('processed-images').remove(processedPaths);
        }

        // Delete DB records
        await supabase
          .from('product_images')
          .delete()
          .eq('product_id', id);

        // Reset product status
        await supabase
          .from('products')
          .update({ status: 'draft' })
          .eq('id', id);
      }
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}.${ext}`;
    const storagePath = `${id}/${filename}`;

    // Upload to Supabase Storage
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, Buffer.from(bytes), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Fehler beim Hochladen in Storage' }, { status: 500 });
    }

    // Get public URL for the uploaded image
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(storagePath);

    // Get current image count for sort order
    const { count } = await supabase
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    // Save to database
    const { data: image, error: dbError } = await supabase
      .from('product_images')
      .insert({
        product_id: id,
        original_path: storagePath,
        filename: file.name,
        sort_order: count || 0,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      id: image.id,
      productId: image.product_id,
      originalPath: urlData.publicUrl,
      processedPath: null,
      filename: image.filename,
      sortOrder: image.sort_order,
      status: image.status,
    }, { status: 201 });
  } catch (error) {
    console.error(`POST /api/products/${id}/images error:`, error);
    return NextResponse.json({ error: 'Fehler beim Hochladen' }, { status: 500 });
  }
}
