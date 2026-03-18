import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { categoryImageType, getImageSpecsForCategory, getShoeViewPrompt } from '@/config/image-processing';
import { processImageWithGemini } from '@/lib/gemini-processor';
import { SHOE_VIEWS } from '@/config/shoe-views';
import { N8N_HEALTH_CHECK_TIMEOUT_MS } from '@/config/constants';
import { requireUser } from '@/lib/auth/require-user';
import { validateAdminToken } from '@/lib/admin-auth';

// Vercel Functions können bis zu 60s laufen (Hobby) / 300s (Pro)
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Allow either user session or admin token
  const adminError = validateAdminToken(request);
  if (adminError) {
    const { error: authError } = await requireUser();
    if (authError) return authError;
  }

  const { id } = await params;

  try {
    const supabase = createServiceRoleClient();

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

    // Clean up old processed files before re-processing
    const alreadyProcessed = product.images.filter(
      (img: { status: string }) => img.status === 'done' || img.status === 'error'
    );
    if (alreadyProcessed.length > 0) {
      console.log(`[Process] Cleaning up ${alreadyProcessed.length} previously processed images`);
      for (const img of alreadyProcessed) {
        if (img.processed_path) {
          // processed_path is stored as full URL, extract storage path
          const storagePath = img.processed_path.includes('/processed-images/')
            ? img.processed_path.split('/processed-images/').pop()
            : null;
          if (storagePath) {
            await supabase.storage.from('processed-images').remove([storagePath]);
          }
        }
      }
      // Reset all images to pending
      await supabase
        .from('product_images')
        .update({ processed_path: null, status: 'pending' })
        .eq('product_id', id);
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    // Prüfe ob n8n erreichbar ist (mit Timeout)
    let n8nAvailable = false;
    if (n8nWebhookUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), N8N_HEALTH_CHECK_TIMEOUT_MS);
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

    // Set all images to processing (batch update instead of N+1)
    await supabase
      .from('product_images')
      .update({ status: 'processing' })
      .eq('product_id', id);

    if (useDirectProcessing) {
      // Parallele Verarbeitung: Alle Bilder gleichzeitig mit Gemini verarbeiten
      // Vermeidet 60s Vercel-Timeout bei mehreren Bildern
      const startTime = Date.now();

      const processOne = async (img: { id: string; filename: string; original_path: string; sort_order?: number }) => {
        const imageUrl = img.original_path.startsWith('http')
          ? img.original_path
          : supabase.storage.from('product-images').getPublicUrl(img.original_path).data.publicUrl;

        try {
          // For shoes: use view-specific prompt based on sort_order (set by classifier)
          let viewPrompt: string | undefined;
          if (imageType === 'shoes' && img.sort_order !== undefined) {
            const view = SHOE_VIEWS.find((v) => v.sortOrder === img.sort_order);
            if (view) {
              viewPrompt = getShoeViewPrompt(view.key);
              console.log(`[Process] Bild ${img.id}: Ansicht "${view.label}" (sort_order=${img.sort_order})`);
            }
          }

          console.log(`[Process] Verarbeite Bild ${img.id} mit Gemini...`);

          const processed = await processImageWithGemini(imageUrl, product.category, viewPrompt);

          const processedFilename = `${img.id}_processed.${processed.format}`;
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

          console.log(`[Process] Bild ${img.id} erfolgreich (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
        } catch (err) {
          console.error(`[Process] Fehler bei Bild ${img.id}:`, err);
          await supabase
            .from('product_images')
            .update({ status: 'error' })
            .eq('id', img.id);
        }
      };

      // Alle Bilder parallel verarbeiten
      await Promise.allSettled(product.images.map(processOne));

      const elapsedSeconds = (Date.now() - startTime) / 1000;

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

      // Always set status to 'processed' — Drive upload runs separately via /upload endpoint.
      // This avoids the 60s Vercel timeout killing the function mid-Drive-upload.
      // The frontend auto-triggers /upload when it detects status='processed'.
      console.log(`[Process] ${doneImages.length} images done in ${elapsedSeconds.toFixed(1)}s. Setting status=processed for separate Drive upload.`);
      await supabase
        .from('products')
        .update({ status: 'processed' })
        .eq('id', id);

      return NextResponse.json({
        status: 'processed',
        imageCount: product.images.length,
        processedCount: doneImages.length,
        imageType,
        specs,
        message: `${doneImages.length} Bild(er) verarbeitet. Drive-Upload wird separat gestartet.`,
      });
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
            adminToken: process.env.N8N_SHARED_SECRET || process.env.ADMIN_TOKEN,
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
      const supabase = createServiceRoleClient();
      await supabase
        .from('products')
        .update({ status: 'error' })
        .eq('id', id);
    } catch (cleanupErr) {
      console.warn('[Process] Cleanup error (setting product status to error):', cleanupErr);
    }

    return NextResponse.json(
      { error: 'Fehler bei der Verarbeitung' },
      { status: 500 }
    );
  }
}
