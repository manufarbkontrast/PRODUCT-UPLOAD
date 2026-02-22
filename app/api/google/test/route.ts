import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import {
  getOrCreateDriveFolderId,
  getAuthStatus,
  getDriveClient,
  listFiles,
  createFolder,
  uploadFile,
  makeFilePublic,
  deleteFile,
} from '@/lib/google';

interface StepResult {
  step: string;
  status: 'ok' | 'error';
  detail: string;
  durationMs?: number;
}

/**
 * GET: Diagnose Google Drive upload pipeline step by step.
 * Tests auth, folder access, file create, file upload, permissions, and Supabase image download.
 * Only available in non-production environments.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const steps: StepResult[] = [];

  // Step 1: Auth status
  try {
    const t0 = Date.now();
    const status = getAuthStatus();
    steps.push({
      step: '1. Auth Status',
      status: status.ready ? 'ok' : 'error',
      detail: `method=${status.method}, driveAuth=${status.driveAuth}, ready=${status.ready}`,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    steps.push({ step: '1. Auth Status', status: 'error', detail: errMsg(err) });
  }

  // Step 2: Get Drive client (includes token refresh)
  try {
    const t0 = Date.now();
    await getDriveClient();
    steps.push({
      step: '2. Drive Client + Token Refresh',
      status: 'ok',
      detail: 'Client created and token refreshed',
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    steps.push({ step: '2. Drive Client', status: 'error', detail: errMsg(err) });
    return NextResponse.json({ overall: 'FAILED', steps });
  }

  // Step 3: Get root folder
  let rootFolderId = '';
  try {
    const t0 = Date.now();
    rootFolderId = await getOrCreateDriveFolderId();
    steps.push({
      step: '3. Root Folder',
      status: 'ok',
      detail: `folderId=${rootFolderId}`,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    steps.push({ step: '3. Root Folder', status: 'error', detail: errMsg(err) });
    return NextResponse.json({ overall: 'FAILED', steps });
  }

  // Step 4: List files in root folder
  try {
    const t0 = Date.now();
    const files = await listFiles(rootFolderId, 5);
    steps.push({
      step: '4. List Files in Root',
      status: 'ok',
      detail: `${files.length} items: ${files.map(f => f.name).join(', ')}`,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    steps.push({ step: '4. List Files', status: 'error', detail: errMsg(err) });
  }

  // Step 5: Create a test sub-folder (same as product upload does)
  let testFolderId = '';
  try {
    const t0 = Date.now();
    const folder = await createFolder(`_debug_test_${Date.now()}`);
    testFolderId = folder.id;
    steps.push({
      step: '5. Create Sub-Folder',
      status: 'ok',
      detail: `id=${folder.id}, url=${folder.webViewLink}`,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    steps.push({ step: '5. Create Sub-Folder', status: 'error', detail: errMsg(err) });
    return NextResponse.json({ overall: 'FAILED', steps });
  }

  // Step 6: Make folder public (same as product upload does)
  try {
    const t0 = Date.now();
    await makeFilePublic(testFolderId);
    steps.push({
      step: '6. Make Folder Public',
      status: 'ok',
      detail: 'Permission set to anyone/reader',
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    steps.push({ step: '6. Make Folder Public', status: 'error', detail: errMsg(err) });
  }

  // Step 7: Upload a small test file into the sub-folder
  let testFileId = '';
  try {
    const t0 = Date.now();
    const testBuffer = Buffer.from('PNG test content — this is a debug file');
    const result = await uploadFile('_debug_test.txt', 'text/plain', testBuffer, testFolderId);
    testFileId = result.id;
    steps.push({
      step: '7. Upload File to Sub-Folder',
      status: 'ok',
      detail: `id=${result.id}, name=${result.name}, url=${result.webViewLink}`,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    steps.push({ step: '7. Upload File', status: 'error', detail: errMsg(err) });
  }

  // Step 8: Make uploaded file public
  if (testFileId) {
    try {
      const t0 = Date.now();
      await makeFilePublic(testFileId);
      steps.push({
        step: '8. Make File Public',
        status: 'ok',
        detail: 'Permission set',
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      steps.push({ step: '8. Make File Public', status: 'error', detail: errMsg(err) });
    }
  }

  // Step 9: Test download from Supabase processed-images bucket
  try {
    const t0 = Date.now();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');

    // Try to fetch the bucket's root to verify connectivity
    const testUrl = `${supabaseUrl}/storage/v1/object/public/processed-images/`;
    const res = await fetch(testUrl, { method: 'HEAD' });
    steps.push({
      step: '9. Supabase Storage Connectivity',
      status: res.status < 500 ? 'ok' : 'error',
      detail: `HEAD ${testUrl.substring(0, 60)}... → HTTP ${res.status}`,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    steps.push({ step: '9. Supabase Storage', status: 'error', detail: errMsg(err) });
  }

  // Cleanup: delete test folder (cascades to test file)
  if (testFolderId) {
    try {
      await deleteFile(testFolderId);
      steps.push({ step: '10. Cleanup', status: 'ok', detail: 'Test folder deleted' });
    } catch (err) {
      steps.push({ step: '10. Cleanup', status: 'error', detail: errMsg(err) });
    }
  }

  const allOk = steps.every(s => s.status === 'ok');
  return NextResponse.json({ overall: allOk ? 'ALL PASS' : 'SOME FAILED', steps });
}

function errMsg(err: unknown): string {
  if (err instanceof Error) {
    return `${err.message}${err.stack ? '\n' + err.stack.split('\n').slice(0, 3).join('\n') : ''}`;
  }
  return String(err);
}
