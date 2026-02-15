import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { processImageWithGemini } from '@/lib/gemini-processor';
import { validateAdminToken } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  try {
    const { imageUrl, productId, imageId, filename, category } = await request.json();

    if (!imageUrl || !productId || !imageId || !filename || !category) {
      return NextResponse.json(
        { success: false, error: 'Fehlende Parameter: imageUrl, productId, imageId, filename, category' },
        { status: 400 }
      );
    }

    console.log(`[Internal] Processing image ${imageId} for product ${productId}`);

    // Process with Gemini + Sharp
    const processed = await processImageWithGemini(imageUrl, category);

    // Generate storage path
    const baseName = filename.replace(/\.[^.]+$/, '');
    const processedFilename = `${baseName}_processed.${processed.format}`;
    const storagePath = `${productId}/${processedFilename}`;

    console.log(`[Internal] Uploading to: ${storagePath}`);

    // Upload to Supabase Storage
    const supabase = createServiceRoleClient();
    const { error: uploadError } = await supabase.storage
      .from('processed-images')
      .upload(storagePath, processed.imageBuffer, {
        contentType: processed.mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('processed-images')
      .getPublicUrl(storagePath);

    console.log(`[Internal] Done: ${imageId}`);

    return NextResponse.json({
      success: true,
      processedUrl: urlData.publicUrl,
      storagePath,
      format: processed.format,
      imageId,
      productId,
    });
  } catch (error) {
    console.error('[Internal] Processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
