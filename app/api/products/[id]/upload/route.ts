import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { uploadProductToDrive } from '@/lib/google';

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

    // Check if any images have been processed (or at least uploaded)
    const hasProcessedImages = product.images.some(
      (img: Record<string, unknown>) => img.processed_path || img.original_path
    );
    if (!hasProcessedImages) {
      return NextResponse.json({ error: 'Bilder müssen erst verarbeitet werden' }, { status: 400 });
    }

    // Update status to uploading
    await supabase
      .from('products')
      .update({ status: 'uploading' })
      .eq('id', id);

    console.log(`Starting upload for product ${id}: ${product.name}`);

    // Get public URLs for images from Supabase Storage
    const imagesWithUrls = product.images.map((img: Record<string, unknown>) => {
      const path = (img.processed_path || img.original_path) as string;
      const bucket = img.processed_path ? 'processed-images' : 'product-images';

      // Check if path is already a full URL
      const isFullUrl = path.startsWith('http');
      const imageUrl = isFullUrl
        ? path
        : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

      return {
        id: img.id as string,
        originalPath: imageUrl,
        processedPath: img.processed_path ? imageUrl : null,
        filename: img.filename as string,
        sortOrder: img.sort_order as number,
      };
    });

    // Upload to Google Drive and add to Sheets
    const uploadResult = await uploadProductToDrive({
      id: product.id,
      ean: product.ean,
      name: product.name,
      gender: product.gender,
      category: product.category,
      description: product.description,
      sku: product.sku,
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

    console.log(`Upload complete for product ${id}`);
    console.log(`Folder URL: ${uploadResult.folderUrl}`);

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
    console.error(`POST /api/products/${id}/upload error:`, error);

    // Reset status on error
    const supabase = createServerClient();
    await supabase
      .from('products')
      .update({ status: 'error' })
      .eq('id', id)
      .then(() => {});

    return NextResponse.json(
      {
        error: 'Fehler beim Upload zu Google Drive',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
