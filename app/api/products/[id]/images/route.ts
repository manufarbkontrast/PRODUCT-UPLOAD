import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServerClient();

    // Check if product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Nur Bilder erlaubt' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${Date.now()}.${ext}`;
    const storagePath = `${id}/${filename}`;

    // Upload to Supabase Storage
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, Buffer.from(bytes), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Fehler beim Hochladen in Storage' }, { status: 500 });
    }

    // Get public URL for the uploaded image
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(storagePath);

    // Get current image count for sort order
    const { count } = await supabase
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    // Save to database
    const { data: image, error: dbError } = await supabase
      .from('product_images')
      .insert({
        product_id: id,
        original_path: storagePath,
        filename: file.name,
        sort_order: count || 0,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      id: image.id,
      productId: image.product_id,
      originalPath: urlData.publicUrl,
      processedPath: null,
      filename: image.filename,
      sortOrder: image.sort_order,
      status: image.status,
    }, { status: 201 });
  } catch (error) {
    console.error(`POST /api/products/${id}/images error:`, error);
    return NextResponse.json({ error: 'Fehler beim Hochladen' }, { status: 500 });
  }
}
