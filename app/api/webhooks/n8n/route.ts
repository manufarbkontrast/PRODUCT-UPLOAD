import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { validateAdminToken } from '@/lib/admin-auth';
import { uploadProductToDrive } from '@/lib/google';

export async function POST(request: NextRequest) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  try {
    const { success, processedUrl, storagePath, imageId, productId, error: processingError } = await request.json();

    if (!imageId || !productId) {
      return NextResponse.json(
        { error: 'Fehlende Parameter: imageId, productId' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    if (success) {
      // Update image record with processed path
      console.log(`[Webhook] Image ${imageId} done: ${storagePath}`);
      await supabase
        .from('product_images')
        .update({
          processed_path: storagePath,
          status: 'done',
        })
        .eq('id', imageId);
    } else {
      // Mark image as error
      console.error(`[Webhook] Image ${imageId} error: ${processingError}`);
      await supabase
        .from('product_images')
        .update({ status: 'error' })
        .eq('id', imageId);
    }

    // Check if all images for this product are done
    const { data: allImages } = await supabase
      .from('product_images')
      .select('id, status, filename, original_path, processed_path, sort_order')
      .eq('product_id', productId);

    if (allImages && allImages.length > 0) {
      const allDone = allImages.every(img => img.status === 'done');
      const allError = allImages.every(img => img.status === 'error');
      const hasProcessing = allImages.some(
        img => img.status === 'processing' || img.status === 'pending'
      );

      if (allDone) {
        // All images processed → automatically upload to Google Drive
        console.log(`[Webhook] All ${allImages.length} images done for product ${productId} → starting Drive upload`);

        await supabase
          .from('products')
          .update({ status: 'uploading' })
          .eq('id', productId);

        // Get product details for Drive upload
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (product) {
          try {
            // Build image data with public URLs from Supabase Storage
            const imagesWithUrls = allImages.map((img) => {
              const path = (img.processed_path || img.original_path) as string;
              const bucket = img.processed_path ? 'processed-images' : 'product-images';
              const isFullUrl = path.startsWith('http');
              const imageUrl = isFullUrl
                ? path
                : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

              return {
                id: img.id as string,
                originalPath: supabase.storage.from('product-images').getPublicUrl(img.original_path as string).data.publicUrl,
                processedPath: img.processed_path ? imageUrl : null,
                filename: img.filename as string,
                sortOrder: (img.sort_order as number) || 0,
              };
            });

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

            // Update product with Drive URL and final status
            await supabase
              .from('products')
              .update({
                status: 'uploaded',
                drive_url: uploadResult.folderUrl,
              })
              .eq('id', productId);

            console.log(`[Webhook] Product ${productId} uploaded to Drive: ${uploadResult.folderUrl}`);
          } catch (driveError) {
            console.error(`[Webhook] Drive upload failed for product ${productId}:`, driveError);
            // Set to 'drive_error' so user knows images are processed but Drive upload failed
            // They can retry via /api/products/[id]/upload
            await supabase
              .from('products')
              .update({ status: 'drive_error' })
              .eq('id', productId);
          }
        }
      } else if (allError) {
        await supabase
          .from('products')
          .update({ status: 'error' })
          .eq('id', productId);
        console.log(`[Webhook] Product ${productId} status → error`);
      } else if (hasProcessing) {
        // Still processing, don't change status
        console.log(`[Webhook] Product ${productId} still processing...`);
      } else {
        await supabase
          .from('products')
          .update({ status: 'draft' })
          .eq('id', productId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook-Verarbeitung fehlgeschlagen', details: String(error) },
      { status: 500 }
    );
  }
}
