import { NextRequest, NextResponse } from 'next/server';
import { validateAdminToken } from '@/lib/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/retry-errors
 * Finds all products/images with error status, resets them to pending,
 * and fires off reprocessing requests (fire-and-forget).
 * Requires X-Admin-Token header.
 */
export async function POST(request: NextRequest) {
  const authError = validateAdminToken(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();

  // Find all products that have error status OR contain error images
  const { data: errorProducts } = await supabase
    .from('products')
    .select('id, name, status')
    .eq('status', 'error');

  const { data: errorImages } = await supabase
    .from('product_images')
    .select('product_id')
    .eq('status', 'error');

  const errorProductIds = new Set([
    ...(errorProducts?.map(p => p.id) || []),
    ...(errorImages?.map(i => i.product_id) || []),
  ]);

  if (errorProductIds.size === 0) {
    return NextResponse.json({ message: 'Keine Fehler-Produkte gefunden', retried: 0 });
  }

  const productIds = [...errorProductIds];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://spz-product-upload.vercel.app';
  const adminToken = request.headers.get('X-Admin-Token')!;

  // Fire-and-forget: trigger process for each product
  // Each runs in its own serverless function with its own 60s timeout
  for (const productId of productIds) {
    fetch(`${siteUrl}/api/products/${productId}/process`, {
      method: 'POST',
      headers: { 'X-Admin-Token': adminToken },
    }).catch(err => {
      console.error(`[retry-errors] Failed to trigger process for ${productId}:`, err);
    });
  }

  return NextResponse.json({
    message: `Reprocessing gestartet für ${productIds.length} Produkt(e)`,
    retried: productIds.length,
    productIds,
  });
}
