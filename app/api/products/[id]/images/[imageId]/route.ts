import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params;

  try {
    const supabase = createServerClient();

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
      await supabase.storage.from('product-images').remove([image.original_path]);
    }
    if (image.processed_path) {
      await supabase.storage.from('processed-images').remove([image.processed_path]);
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
