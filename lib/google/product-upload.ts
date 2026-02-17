import { createFolder, uploadFile, makeFilePublic, listFiles, getFile, UploadResult } from './drive';
import { IMAGE_DOWNLOAD_MAX_RETRIES, IMAGE_DOWNLOAD_RETRY_DELAY_MS } from '@/config/constants';

export interface ProductUploadData {
  id: string;
  ean: string | null;
  name: string;
  gender: string;
  category: string;
  description: string | null;
  sku: string | null;
  existingDriveUrl?: string | null;
  zalandoAttributes?: Record<string, string> | null;
  images: Array<{
    id: string;
    originalPath: string;
    processedPath: string | null;
    filename: string;
    sortOrder: number;
  }>;
}

export interface ProductUploadResult {
  folderId: string;
  folderUrl: string;
  uploadedFiles: UploadResult[];
  folderReused: boolean;
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Extract folder ID from a Google Drive folder URL.
 * URL format: https://drive.google.com/drive/folders/{FOLDER_ID}
 */
function extractFolderIdFromUrl(driveUrl: string | null | undefined): string | null {
  if (!driveUrl) return null;
  const parts = driveUrl.split('/folders/');
  return parts.length === 2 && parts[1] ? parts[1].split('?')[0] : null;
}

/**
 * Determine the next image number for file naming in an existing folder.
 * Parses filenames like "3_SKU.jpg" to find the highest existing number.
 */
async function getNextImageNumber(folderId: string): Promise<number> {
  const existingFiles = await listFiles(folderId);
  let maxNumber = 0;
  for (const file of existingFiles) {
    const match = file.name.match(/^(\d+)_/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }
  return maxNumber + 1;
}

/**
 * Determine file extension from mime type or URL.
 */
function getExtensionFromMimeOrUrl(mimeType: string, url: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  if (mimeToExt[mimeType]) return mimeToExt[mimeType];
  const urlExt = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (urlExt && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt)) {
    return urlExt === 'jpeg' ? 'jpg' : urlExt;
  }
  return 'jpg';
}

// ---------------------------------------------------------------------------
// Image download with retry
// ---------------------------------------------------------------------------

/**
 * Download an image from a URL with retry logic (3 attempts, 1 s pause).
 */
async function downloadImageFromUrl(
  url: string,
  maxRetries: number = IMAGE_DOWNLOAD_MAX_RETRIES
): Promise<{ buffer: Buffer; mimeType: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DriveUpload] Download attempt ${attempt}/${maxRetries}: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length === 0) {
        throw new Error('Downloaded file is empty (0 bytes)');
      }
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      return { buffer, mimeType };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[DriveUpload] Download attempt ${attempt} failed: ${lastError.message}`);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, IMAGE_DOWNLOAD_RETRY_DELAY_MS));
      }
    }
  }

  throw new Error(`Failed to download after ${maxRetries} attempts: ${url} — ${lastError?.message}`);
}

// ---------------------------------------------------------------------------
// Folder resolution (reuse existing or create new)
// ---------------------------------------------------------------------------

async function resolveFolder(
  product: ProductUploadData
): Promise<{ folderId: string; folderUrl: string; reused: boolean; startingImageNumber: number }> {
  const existingFolderId = extractFolderIdFromUrl(product.existingDriveUrl);

  if (existingFolderId) {
    const existing = await getFile(existingFolderId);
    if (existing) {
      console.log(`[DriveUpload] Reusing existing folder: ${existingFolderId}`);
      const startingImageNumber = await getNextImageNumber(existingFolderId);
      return {
        folderId: existing.id,
        folderUrl: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
        reused: true,
        startingImageNumber,
      };
    }
    console.warn(`[DriveUpload] Existing folder ${existingFolderId} not found, creating new`);
  }

  const folderName = product.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_.]/g, '').trim()
    || product.id.substring(0, 8);
  console.log(`[DriveUpload] Creating folder: ${folderName}`);
  const folder = await createFolder(folderName);
  await makeFilePublic(folder.id);
  return { folderId: folder.id, folderUrl: folder.webViewLink, reused: false, startingImageNumber: 1 };
}

// ---------------------------------------------------------------------------
// Image upload loop
// ---------------------------------------------------------------------------

async function uploadImages(
  product: ProductUploadData,
  folderId: string,
  startingImageNumber: number,
): Promise<UploadResult[]> {
  const sortedImages = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const sku = product.sku || product.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 30);
  const uploadedFiles: UploadResult[] = [];

  for (let i = 0; i < sortedImages.length; i++) {
    const image = sortedImages[i];
    const primaryUrl = image.processedPath || image.originalPath;
    const fallbackUrl = image.processedPath ? image.originalPath : null;
    if (!primaryUrl) {
      console.error(`[DriveUpload] No URL for image ${image.id}, skipping`);
      continue;
    }

    try {
      let downloadResult: { buffer: Buffer; mimeType: string };
      try {
        downloadResult = await downloadImageFromUrl(primaryUrl);
      } catch (primaryErr) {
        if (fallbackUrl) {
          console.warn(`[DriveUpload] Processed image failed, falling back to original`);
          downloadResult = await downloadImageFromUrl(fallbackUrl);
        } else {
          throw primaryErr;
        }
      }

      const { buffer, mimeType } = downloadResult;
      const ext = getExtensionFromMimeOrUrl(mimeType, primaryUrl);
      const uploadFileName = `${startingImageNumber + i}_${sku}.${ext}`;

      console.log(`[DriveUpload] Uploading ${uploadFileName} (${(buffer.length / 1024).toFixed(0)} KB)`);
      const result = await uploadFile(uploadFileName, mimeType, buffer, folderId);
      await makeFilePublic(result.id);
      uploadedFiles.push(result);
      console.log(`[DriveUpload] Uploaded: ${result.name} (${result.id})`);
    } catch (error) {
      console.error(`[DriveUpload] Failed to upload ${image.filename}:`, error);
    }
  }

  return uploadedFiles;
}

// ---------------------------------------------------------------------------
// Main export: uploadProductToDrive
// ---------------------------------------------------------------------------

/**
 * Upload a product's images to Google Drive.
 * - Reuses existing Drive folder when product was already uploaded.
 * - Adds new images alongside existing ones (no deletion).
 */
export async function uploadProductToDrive(product: ProductUploadData): Promise<ProductUploadResult> {
  const { folderId, folderUrl, reused, startingImageNumber } = await resolveFolder(product);

  const uploadedFiles = await uploadImages(product, folderId, startingImageNumber);

  if (uploadedFiles.length === 0 && product.images.length > 0) {
    throw new Error(`Drive upload failed: 0 of ${product.images.length} images uploaded. Folder created but empty.`);
  }

  return { folderId, folderUrl, uploadedFiles, folderReused: reused };
}
