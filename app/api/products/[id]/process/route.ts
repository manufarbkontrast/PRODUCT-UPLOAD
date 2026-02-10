import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { categoryImageType, getImageSpecsForCategory } from '@/config/image-processing';
import { uploadProductToDrive, type ProductUploadData } from '@/lib/google/product-upload';

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
    console.log(`[Process] n8n URL: ${n8nWebhookUrl || 'nicht konfiguriert'}, verfügbar: ${n8nAvailable}, direkte Verarbeitung: ${useDirectProcessing}`);

    const imageType = categoryImageType[product.category] || 'clothing';
    const specs = getImageSpecsForCategory(product.category);

    console.log(`[Process] Product ${id}: ${product.images.length} images`);
    console.log(`[Process] Category: ${product.category}, Type: ${imageType}`);

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

    // Build callback URL - nutze localhost für lokale Entwicklung
    let internalAppUrl = process.env.INTERNAL_APP_URL || 'http://localhost:3000';

    // Wenn INTERNAL_APP_URL auf Docker-Host zeigt (web-dev), aber lokal läuft, nutze localhost
    if (internalAppUrl.includes('web-dev')) {
      internalAppUrl = 'http://localhost:3000';
      console.log(`[Process] Docker-URL erkannt, nutze localhost stattdessen`);
    }
    const callbackUrl = `${internalAppUrl}/api/webhooks/n8n`;

    if (useDirectProcessing) {
      // Direkte Verarbeitung ohne n8n
      console.log(`[Process] n8n nicht konfiguriert, verarbeite ${product.images.length} Bilder direkt...`);

      for (const img of product.images) {
        let imageUrl: string;
        if (img.original_path.startsWith('http')) {
          imageUrl = img.original_path;
        } else {
          const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(img.original_path);
          imageUrl = urlData.publicUrl;
        }

        try {
          console.log(`[Process] Verarbeite Bild ${img.id} direkt...`);
          const processRes = await fetch(`${internalAppUrl}/api/internal/process-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Admin-Token': process.env.ADMIN_TOKEN || '',
            },
            body: JSON.stringify({
              imageUrl,
              productId: id,
              imageId: img.id,
              filename: img.filename,
              category: product.category,
            }),
          });

          const processResult = await processRes.json();

          if (processResult.success) {
            await supabase
              .from('product_images')
              .update({
                status: 'done',
                processed_path: processResult.processedUrl,
              })
              .eq('id', img.id);
            console.log(`[Process] Bild ${img.id} erfolgreich verarbeitet`);
          } else {
            await supabase
              .from('product_images')
              .update({ status: 'error' })
              .eq('id', img.id);
            console.error(`[Process] Fehler bei Bild ${img.id}:`, processResult.error);
          }
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

      const allDone = updatedImages?.every((i) => i.status === 'done');
      const hasError = updatedImages?.some((i) => i.status === 'error');

      if (hasError || !allDone) {
        await supabase
          .from('products')
          .update({ status: hasError ? 'error' : 'draft' })
          .eq('id', id);

        return NextResponse.json({
          status: 'completed',
          imageCount: product.images.length,
          imageType,
          specs,
          message: `${product.images.length} Bilder verarbeitet (mit Fehlern)`,
        });
      }

      // All images done — trigger Drive upload in background
      await supabase
        .from('products')
        .update({ status: 'uploading' })
        .eq('id', id);

      // Build upload data from fresh image records
      const resolveUrl = (path: string): string => {
        if (path.startsWith('http')) return path;
        return supabase.storage.from('processed-images').getPublicUrl(path).data.publicUrl;
      };

      const resolveOriginalUrl = (path: string): string => {
        if (path.startsWith('http')) return path;
        return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      };

      const uploadData: ProductUploadData = {
        id: product.id,
        ean: product.ean,
        name: product.name,
        gender: product.gender,
        category: product.category,
        description: product.description,
        sku: product.sku,
        images: (updatedImages || []).map((img) => ({
          id: img.id,
          originalPath: resolveOriginalUrl(img.original_path),
          processedPath: img.processed_path ? resolveUrl(img.processed_path) : null,
          filename: img.filename,
          sortOrder: img.sort_order ?? 0,
        })),
      };

      // Fire-and-forget: upload to Drive in background
      uploadProductToDrive(uploadData)
        .then(async (result) => {
          console.log(`[Process] Drive upload complete for product ${id}: ${result.folderUrl}`);
          const sb = createServerClient();
          await sb
            .from('products')
            .update({ status: 'uploaded', drive_url: result.folderUrl })
            .eq('id', id);
        })
        .catch(async (err) => {
          console.error(`[Process] Drive upload failed for product ${id}:`, err);
          const sb = createServerClient();
          await sb
            .from('products')
            .update({ status: 'drive_error' })
            .eq('id', id);
        });

      return NextResponse.json({
        status: 'uploading',
        imageCount: product.images.length,
        imageType,
        specs,
        message: `${product.images.length} Bilder verarbeitet, Upload zu Google Drive gestartet`,
      });
    }

    // Dispatch each image to n8n (fire-and-forget)
    const dispatches = product.images.map(async (img: { id: string; filename: string; original_path: string }) => {
      let imageUrl: string;
      if (img.original_path.startsWith('http')) {
        imageUrl = img.original_path;
      } else {
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(img.original_path);
        imageUrl = urlData.publicUrl;
      }

      try {
        console.log(`[Process] Dispatching image ${img.id} to n8n`);
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

    // Wait for all dispatches to be sent (NOT for processing to complete)
    await Promise.allSettled(dispatches);

    console.log(`[Process] ${product.images.length} images dispatched to n8n`);

    return NextResponse.json({
      status: 'processing',
      imageCount: product.images.length,
      imageType,
      specs,
      message: `${product.images.length} Bilder zur Verarbeitung an n8n gesendet`,
    });
  } catch (error) {
    console.error(`POST /api/products/${id}/process error:`, error);

    // Reset status on error
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
