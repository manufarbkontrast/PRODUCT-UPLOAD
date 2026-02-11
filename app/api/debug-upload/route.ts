import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createFolder, uploadFile, makeFilePublic } from '@/lib/google/drive';
import { getGoogleAuth } from '@/lib/google/auth';

export const maxDuration = 60;

/**
 * Debug endpoint: Full upload test with detailed error logging.
 * GET: Test image URLs and Service Account info
 * POST: Test full Drive upload pipeline step by step
 */
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('productId');

  const result: Record<string, unknown> = {};

  // Show auth info
  try {
    const auth = await getGoogleAuth();
    result.authType = auth.constructor.name;
  } catch (err) {
    result.authError = err instanceof Error ? err.message : String(err);
  }

  // Get service account email from env
  try {
    const envSa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (envSa) {
      const decoded = JSON.parse(Buffer.from(envSa, 'base64').toString('utf-8'));
      result.envServiceAccountEmail = decoded.client_email;
      result.envProjectId = decoded.project_id;
    }
  } catch {
    result.envDecodeError = true;
  }

  result.driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'not set';
  result.sheetId = process.env.GOOGLE_SHEET_ID || 'not set';
  result.sheetName = process.env.GOOGLE_SHEET_NAME || 'not set (default: Produkte)';

  if (!productId) {
    return NextResponse.json({ ...result, hint: 'Add ?productId=xxx to test image downloads' });
  }

  const supabase = createServerClient();
  const { data: images, error } = await supabase
    .from('product_images')
    .select('id, filename, original_path, processed_path, status')
    .eq('product_id', productId);

  if (error) {
    return NextResponse.json({ ...result, error: error.message }, { status: 500 });
  }

  const imageResults = [];
  for (const img of images || []) {
    const processedUrl = img.processed_path?.startsWith('http')
      ? img.processed_path
      : img.processed_path
        ? supabase.storage.from('processed-images').getPublicUrl(img.processed_path).data.publicUrl
        : null;
    const originalUrl = img.original_path.startsWith('http')
      ? img.original_path
      : supabase.storage.from('product-images').getPublicUrl(img.original_path).data.publicUrl;

    const url = processedUrl || originalUrl;
    let downloadOk = false;
    let downloadSize = 0;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        downloadOk = true;
        downloadSize = buf.byteLength;
      }
    } catch { /* ignore */ }

    imageResults.push({ id: img.id, status: img.status, url: url.substring(0, 100), downloadOk, downloadSize });
  }

  return NextResponse.json({ ...result, productId, images: imageResults });
}

export async function POST(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('productId');
  if (!productId) {
    return NextResponse.json({ error: 'productId query param required' }, { status: 400 });
  }

  const steps: Array<{ step: string; ok: boolean; detail?: string; error?: string }> = [];
  const supabase = createServerClient();

  // Step 1: Fetch product
  const { data: product, error: productError } = await supabase
    .from('products')
    .select(`*, images:product_images(id, filename, original_path, processed_path, status, sort_order)`)
    .eq('id', productId)
    .single();

  if (productError || !product) {
    steps.push({ step: 'fetch_product', ok: false, error: productError?.message || 'Not found' });
    return NextResponse.json({ steps });
  }
  steps.push({ step: 'fetch_product', ok: true, detail: `${product.name} (${product.images?.length} images)` });

  // Step 2: Create folder
  let folderId: string;
  try {
    const folder = await createFolder(`DEBUG-${product.name.substring(0, 30)}`);
    folderId = folder.id;
    steps.push({ step: 'create_folder', ok: true, detail: `id=${folder.id}` });
  } catch (err) {
    steps.push({ step: 'create_folder', ok: false, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ steps });
  }

  // Step 3: Make folder public
  try {
    await makeFilePublic(folderId);
    steps.push({ step: 'make_folder_public', ok: true });
  } catch (err) {
    steps.push({ step: 'make_folder_public', ok: false, error: err instanceof Error ? err.message : String(err) });
  }

  // Step 4: Download and upload each image
  const doneImages = (product.images || []).filter(
    (img: Record<string, unknown>) => img.status === 'done' || img.original_path
  );

  for (let i = 0; i < doneImages.length; i++) {
    const img = doneImages[i];
    const processedUrl = img.processed_path?.startsWith('http')
      ? img.processed_path
      : img.processed_path
        ? supabase.storage.from('processed-images').getPublicUrl(img.processed_path).data.publicUrl
        : null;
    const originalUrl = img.original_path.startsWith('http')
      ? img.original_path
      : supabase.storage.from('product-images').getPublicUrl(img.original_path).data.publicUrl;

    const url = processedUrl || originalUrl;

    // Download
    let buffer: Buffer;
    let mimeType: string;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = res.headers.get('content-type') || 'image/jpeg';
      steps.push({ step: `download_${i}`, ok: true, detail: `${buffer.length} bytes` });
    } catch (err) {
      steps.push({ step: `download_${i}`, ok: false, error: err instanceof Error ? err.message : String(err) });
      continue;
    }

    // Upload to Drive
    try {
      const ext = mimeType.includes('webp') ? 'webp' : mimeType.includes('png') ? 'png' : 'jpg';
      const result = await uploadFile(`${i + 1}_debug.${ext}`, mimeType, buffer, folderId);
      steps.push({ step: `upload_${i}`, ok: true, detail: `${result.name} (${result.id})` });
    } catch (err) {
      steps.push({ step: `upload_${i}`, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ productId, steps });
}
