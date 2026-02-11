import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { uploadProductToDrive } from '@/lib/google';

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServerClient();

    const { data: product, error: productError } = await supabase
      .from('products')
      .select(`
        *,
        images:product_images(id, filename, original_path, processed_path, status, sort_order)
      `)
      .eq('id', id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    if (!product.images || product.images.length === 0) {
      return NextResponse.json({ error: 'Keine Bilder vorhanden' }, { status: 400 });
    }

    // Only upload images that have been processed (status: done) or at least have an original
    const uploadableImages = product.images.filter(
      (img: Record<string, unknown>) => img.status === 'done' || img.original_path
    );
    if (uploadableImages.length === 0) {
      return NextResponse.json({ error: 'Keine uploadbaren Bilder vorhanden' }, { status: 400 });
    }

    // Update status to uploading
    await supabase
      .from('products')
      .update({ status: 'uploading' })
      .eq('id', id);

    console.log(`[Upload] Starting upload for product ${id}: ${product.name} (${uploadableImages.length} images)`);

    // Build image URLs with proper originalPath and processedPath separation
    const resolveUrl = (path: string, bucket: string): string => {
      if (path.startsWith('http')) return path;
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    };

    const imagesWithUrls = uploadableImages.map((img: Record<string, unknown>) => {
      const originalUrl = resolveUrl(img.original_path as string, 'product-images');
      const processedUrl = img.processed_path
        ? resolveUrl(img.processed_path as string, 'processed-images')
        : null;

      return {
        id: img.id as string,
        originalPath: originalUrl,
        processedPath: processedUrl,
        filename: img.filename as string,
        sortOrder: (img.sort_order as number) ?? 0,
      };
    });

    for (const imgInfo of imagesWithUrls) {
      console.log(`[Upload] Image ${imgInfo.id}: processed=${!!imgInfo.processedPath}, original=${imgInfo.originalPath.substring(0, 80)}`);
    }

    // Upload to Google Drive and add to Sheets
    const uploadResult = await uploadProductToDrive({
      id: product.id,
      ean: product.ean,
      name: product.name,
      gender: product.gender,
      category: product.category,
      description: product.description,
      sku: product.sku,
      existingDriveUrl: product.drive_url || null,
      zalandoAttributes: product.zalando_attributes || null,
      images: imagesWithUrls,
    });

    // Update product with Drive URL and status
    const { data: updatedProduct } = await supabase
      .from('products')
      .update({
        status: 'uploaded',
        drive_url: uploadResult.folderUrl,
      })
      .eq('id', id)
      .select()
      .single();

    console.log(`[Upload] Complete for product ${id}: ${uploadResult.folderUrl}`);

    return NextResponse.json({
      success: true,
      driveUrl: updatedProduct?.drive_url || uploadResult.folderUrl,
      folderId: uploadResult.folderId,
      uploadedFiles: uploadResult.uploadedFiles.length,
      sheetRowAdded: uploadResult.sheetRowAdded,
      files: uploadResult.uploadedFiles.map((f) => ({
        name: f.name,
        url: f.webViewLink,
      })),
    });
  } catch (error) {
    console.error(`[Upload] POST /api/products/${id}/upload error:`, error);

    // Set status to drive_error (not generic error) so frontend can offer retry
    try {
      const supabase = createServerClient();
      await supabase
        .from('products')
        .update({ status: 'drive_error' })
        .eq('id', id);
    } catch {
      // ignore cleanup errors
    }

    return NextResponse.json(
      {
        error: 'Fehler beim Upload zu Google Drive',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
