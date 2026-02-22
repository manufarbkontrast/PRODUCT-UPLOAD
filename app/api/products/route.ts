import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/require-user';
import { resolveStorageUrl } from '@/lib/supabase/storage-url';

export async function GET() {
  const { error: authError } = await requireUser();
  if (authError) return authError;

  try {
    const supabase = createServiceRoleClient();

    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        images:product_images(id, filename, original_path, processed_path, status, sort_order)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map to camelCase for frontend compatibility
    const mapped = (products || []).map(p => ({
      id: p.id,
      ean: p.ean,
      name: p.name,
      gender: p.gender,
      category: p.category,
      description: p.description,
      sku: p.sku,
      status: p.status,
      driveUrl: p.drive_url,
      zalandoAttributes: p.zalando_attributes,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      images: (p.images || []).map((img: Record<string, unknown>) => ({
        id: img.id,
        filename: img.filename,
        originalPath: resolveStorageUrl(supabase, img.original_path, 'product-images'),
        processedPath: resolveStorageUrl(supabase, img.processed_path, 'processed-images'),
        status: img.status,
        sortOrder: img.sort_order,
      })),
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('GET /api/products error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Produkte' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireUser();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { ean, name, gender, category, description, sku, zalandoAttributes } = body;

    if (!name || !gender || !category) {
      return NextResponse.json(
        { error: 'Name, Geschlecht und Kategorie sind erforderlich' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const sanitizedEan = ean?.trim() || null;

    // Wenn EAN vorhanden: prüfen ob schon ein Produkt existiert
    if (sanitizedEan) {
      const { data: existing } = await supabase
        .from('products')
        .select()
        .eq('ean', sanitizedEan)
        .maybeSingle();

      if (existing) {
        // Bestehendes Produkt zurückgeben — Client leitet dorthin weiter
        return NextResponse.json({
          id: existing.id,
          ean: existing.ean,
          name: existing.name,
          gender: existing.gender,
          category: existing.category,
          description: existing.description,
          sku: existing.sku,
          status: existing.status,
          driveUrl: existing.drive_url,
          zalandoAttributes: existing.zalando_attributes,
          createdAt: existing.created_at,
          updatedAt: existing.updated_at,
          existingProduct: true,
        }, { status: 200 });
      }
    }

    const insertData = {
      ean: sanitizedEan,
      name,
      gender,
      category,
      description: description || null,
      sku: sku || null,
      status: 'draft',
      zalando_attributes: zalandoAttributes || null,
    };

    const { data: product, error } = await supabase
      .from('products')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      id: product.id,
      ean: product.ean,
      name: product.name,
      gender: product.gender,
      category: product.category,
      description: product.description,
      sku: product.sku,
      status: product.status,
      driveUrl: product.drive_url,
      zalandoAttributes: product.zalando_attributes,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/products error:', error);

    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Produkts' },
      { status: 500 }
    );
  }
}
