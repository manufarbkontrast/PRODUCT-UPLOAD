import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { categoryImageType, getImageSpecsForCategory } from '@/config/image-processing';
import { processImageWithGemini } from '@/lib/gemini-processor';
import { uploadProductToDrive, type ProductUploadData } from '@/lib/google/product-upload';

// Vercel Functions können bis zu 60s laufen (Hobby) / 300s (Pro)
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServerClient();

    // Fetch product with images
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

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    // Prüfe ob n8n erreichbar ist (mit Timeout)
    let n8nAvailable = false;
    if (n8nWebhookUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const testRes = await fetch(n8nWebhookUrl.replace('/webhook/', '/healthz').replace('/process-image', ''), {
          method: 'GET',
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(timeoutId);
        n8nAvailable = testRes !== null && testRes.status < 500;
      } catch {
        n8nAvailable = false;
      }
    }

    const useDirectProcessing = !n8nWebhookUrl || !n8nAvailable;

    const imageType = categoryImageType[product.category] || 'clothing';
    const specs = getImageSpecsForCategory(product.category);

    console.log(`[Process] Product ${id}: ${product.images.length} images, direct: ${useDirectProcessing}`);

    // Update product status to processing
    await supabase
      .from('products')
      .update({ status: 'processing' })
      .eq('id', id);

    // Set all images to processing
    for (const img of product.images) {
      await supabase
        .from('product_images')
        .update({ status: 'processing' })
        .eq('id', img.id);
    }

    if (useDirectProcessing) {
      // Direkte Verarbeitung: Gemini + Sharp direkt aufrufen (kein HTTP Self-Call)
      for (const img of product.images) {
        const imageUrl = img.original_path.startsWith('http')
          ? img.original_path
          : supabase.storage.from('product-images').getPublicUrl(img.original_path).data.publicUrl;

        try {
          console.log(`[Process] Verarbeite Bild ${img.id} direkt mit Gemini...`);

          // Gemini + Sharp direkt aufrufen
          const processed = await processImageWithGemini(imageUrl, product.category);

          // Upload verarbeitetes Bild zu Supabase Storage
          const baseName = img.filename.replace(/\.[^.]+$/, '');
          const processedFilename = `${baseName}_processed.${processed.format}`;
          const storagePath = `${id}/${processedFilename}`;

          const { error: uploadError } = await supabase.storage
            .from('processed-images')
            .upload(storagePath, processed.imageBuffer, {
              contentType: processed.mimeType,
              upsert: true,
            });

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          const { data: urlData } = supabase.storage
            .from('processed-images')
            .getPublicUrl(storagePath);

          await supabase
            .from('product_images')
            .update({
              status: 'done',
              processed_path: urlData.publicUrl,
            })
            .eq('id', img.id);

          console.log(`[Process] Bild ${img.id} erfolgreich verarbeitet`);
        } catch (err) {
          console.error(`[Process] Fehler bei Bild ${img.id}:`, err);
          await supabase
            .from('product_images')
            .update({ status: 'error' })
            .eq('id', img.id);
        }
      }

      // Produkt-Status aktualisieren
      const { data: updatedImages } = await supabase
        .from('product_images')
        .select('id, filename, original_path, processed_path, status, sort_order')
        .eq('product_id', id);

      const doneImages = updatedImages?.filter((i) => i.status === 'done') || [];
      const allError = updatedImages?.every((i) => i.status === 'error');

      if (allError || doneImages.length === 0) {
        await supabase
          .from('products')
          .update({ status: 'error' })
          .eq('id', id);

        return NextResponse.json({
          status: 'error',
          imageCount: product.images.length,
          imageType,
          specs,
          message: `Alle ${product.images.length} Bilder fehlgeschlagen`,
        });
      }

      // At least some images are done — upload them to Google Drive
      await supabase
        .from('products')
        .update({ status: 'uploading' })
        .eq('id', id);

      const resolveUrl = (path: string): string => {
        if (path.startsWith('http')) return path;
        return supabase.storage.from('processed-images').getPublicUrl(path).data.publicUrl;
      };

      const resolveOriginalUrl = (path: string): string => {
        if (path.startsWith('http')) return path;
        return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      };

      // Only include successfully processed images for Drive upload
      const uploadData: ProductUploadData = {
        id: product.id,
        ean: product.ean,
        name: product.name,
        gender: product.gender,
        category: product.category,
        description: product.description,
        sku: product.sku,
        images: doneImages.map((img) => ({
          id: img.id,
          originalPath: resolveOriginalUrl(img.original_path),
          processedPath: img.processed_path ? resolveUrl(img.processed_path) : null,
          filename: img.filename,
          sortOrder: img.sort_order ?? 0,
        })),
      };

      // Upload to Drive synchronously (await) so Vercel doesn't kill the function
      try {
        const result = await uploadProductToDrive(uploadData);
        console.log(`[Process] Drive upload complete for product ${id}: ${result.folderUrl}`);
        await supabase
          .from('products')
          .update({ status: 'uploaded', drive_url: result.folderUrl })
          .eq('id', id);

        return NextResponse.json({
          status: 'uploaded',
          imageCount: product.images.length,
          processedCount: doneImages.length,
          imageType,
          specs,
          driveUrl: result.folderUrl,
          message: `${doneImages.length} Bild(er) verarbeitet und zu Google Drive hochgeladen`,
        });
      } catch (driveErr) {
        console.error(`[Process] Drive upload failed for product ${id}:`, driveErr);
        await supabase
          .from('products')
          .update({ status: 'drive_error' })
          .eq('id', id);

        return NextResponse.json({
          status: 'drive_error',
          imageCount: product.images.length,
          processedCount: doneImages.length,
          imageType,
          specs,
          message: `Bilder verarbeitet, aber Drive-Upload fehlgeschlagen: ${driveErr instanceof Error ? driveErr.message : String(driveErr)}`,
        });
      }
    }

    // n8n mode: Dispatch each image to n8n (fire-and-forget)
    const internalAppUrl = process.env.INTERNAL_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const callbackUrl = `${internalAppUrl}/api/webhooks/n8n`;

    const dispatches = product.images.map(async (img: { id: string; filename: string; original_path: string }) => {
      const imageUrl = img.original_path.startsWith('http')
        ? img.original_path
        : supabase.storage.from('product-images').getPublicUrl(img.original_path).data.publicUrl;

      try {
        await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            productId: id,
            imageId: img.id,
            filename: img.filename,
            category: product.category,
            callbackUrl,
            adminToken: process.env.ADMIN_TOKEN,
            internalAppUrl,
          }),
        });
      } catch (err) {
        console.error(`[Process] Failed to dispatch image ${img.id} to n8n:`, err);
      }
    });

    await Promise.allSettled(dispatches);

    return NextResponse.json({
      status: 'processing',
      imageCount: product.images.length,
      imageType,
      specs,
      message: `${product.images.length} Bilder zur Verarbeitung an n8n gesendet`,
    });
  } catch (error) {
    console.error(`POST /api/products/${id}/process error:`, error);

    try {
      const supabase = createServerClient();
      await supabase
        .from('products')
        .update({ status: 'error' })
        .eq('id', id);
    } catch {
      // ignore cleanup errors
    }

    return NextResponse.json(
      { error: 'Fehler bei der Verarbeitung', details: String(error) },
      { status: 500 }
    );
  }
}
