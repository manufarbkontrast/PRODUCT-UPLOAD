import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
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
      // original_path is stored as relative path (e.g. "product-id/filename.jpg")
      const originalStoragePath = image.original_path.includes('/product-images/')
        ? image.original_path.split('/product-images/').pop()!
        : image.original_path;
      await supabase.storage.from('product-images').remove([originalStoragePath]);
    }
    if (image.processed_path) {
      // processed_path is stored as full URL, extract storage path
      const processedStoragePath = image.processed_path.includes('/processed-images/')
        ? image.processed_path.split('/processed-images/').pop()!
        : image.processed_path;
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
