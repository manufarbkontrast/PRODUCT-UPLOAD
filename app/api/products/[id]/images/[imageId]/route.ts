import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';
import { extractStoragePath } from '@/lib/supabase/storage-path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { error: authError } = await requireUser();
  if (authError) return authError;

  const { id, imageId } = await params;

  try {
    const supabase = createServiceRoleClient();

    // Get image record
    const { data: image, error: fetchError } = await supabase
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .eq('product_id', id)
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Bild nicht gefunden' }, { status: 404 });
    }

    // Delete from Storage
    if (image.original_path) {
      const originalStoragePath = extractStoragePath(image.original_path, 'product-images');
      await supabase.storage.from('product-images').remove([originalStoragePath]);
    }
    if (image.processed_path) {
      const processedStoragePath = extractStoragePath(image.processed_path, 'processed-images');
      await supabase.storage.from('processed-images').remove([processedStoragePath]);
    }

    // Delete DB record
    const { error: deleteError } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/products/${id}/images/${imageId} error:`, error);
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 });
  }
}
