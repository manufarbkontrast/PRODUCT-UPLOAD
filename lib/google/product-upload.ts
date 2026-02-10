import { createFolder, uploadFile, makeFilePublic, UploadResult } from './drive';
import { appendToSheet } from './sheets';
import { getDefaultSheetName } from './setup';

export interface ProductUploadData {
  id: string;
  ean: string | null;
  name: string;
  gender: string;
  category: string;
  description: string | null;
  sku: string | null;
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
  sheetRowAdded: boolean;
}

/**
 * Download an image from a URL and return it as a Buffer
 */
async function downloadImageFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

/**
 * Determine file extension from mime type or URL
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

/**
 * Upload a complete product to Google Drive and add to Google Sheets.
 * Downloads images from URLs (Supabase Storage) and uploads them to Drive.
 * Files are named: 1_SKU.ext, 2_SKU.ext, etc.
 */
export async function uploadProductToDrive(product: ProductUploadData): Promise<ProductUploadResult> {
  // Folder name = product name (used as the subfolder in Drive)
  const folderName = product.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_.]/g, '').trim() || product.id.substring(0, 8);

  // Create product folder in Drive
  console.log(`[DriveUpload] Creating folder: ${folderName}`);
  const folder = await createFolder(folderName);

  // Make folder publicly accessible
  await makeFilePublic(folder.id);

  const uploadedFiles: UploadResult[] = [];

  // Sort images by sortOrder
  const sortedImages = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);

  // SKU for file naming (fallback to product name sanitized)
  const sku = product.sku || product.name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 30);

  // Upload each image sequentially
  for (let i = 0; i < sortedImages.length; i++) {
    const image = sortedImages[i];

    // Use processed path if available, otherwise original
    const imageUrl = image.processedPath || image.originalPath;

    if (!imageUrl) {
      console.error(`[DriveUpload] No URL for image ${image.id}`);
      continue;
    }

    try {
      // Download image from URL (Supabase Storage)
      console.log(`[DriveUpload] Downloading image ${i + 1}/${sortedImages.length}: ${imageUrl}`);
      const { buffer, mimeType } = await downloadImageFromUrl(imageUrl);

      // File name: 1_SKU.jpg, 2_SKU.jpg, etc.
      const ext = getExtensionFromMimeOrUrl(mimeType, imageUrl);
      const uploadFileName = `${i + 1}_${sku}.${ext}`;

      // Upload to Drive
      const result = await uploadFile(uploadFileName, mimeType, buffer, folder.id);

      // Make file publicly accessible
      await makeFilePublic(result.id);

      uploadedFiles.push(result);
      console.log(`[DriveUpload] Uploaded: ${result.name}`);
    } catch (error) {
      console.error(`[DriveUpload] Failed to upload ${image.filename}:`, error);
      // Continue with remaining images instead of aborting the entire upload
    }
  }

  // Add product data to Google Sheets
  let sheetRowAdded = false;
  try {
    const imageUrls = uploadedFiles.map((f) => f.webViewLink).join('\n');

    const rowData = [
      new Date().toISOString(),           // Timestamp
      product.id,                          // Product ID
      product.ean || '',                   // EAN
      product.name,                        // Name
      product.gender,                      // Gender
      product.category,                    // Category
      product.description || '',           // Description
      product.sku || '',                   // SKU
      folder.webViewLink,                  // Drive Folder URL
      uploadedFiles.length.toString(),     // Number of images
      imageUrls,                           // Image URLs (newline separated)
    ];

    await appendToSheet([rowData], `${getDefaultSheetName()}!A:L`);
    sheetRowAdded = true;
    console.log('Product added to Google Sheets');
  } catch (error) {
    console.error('Failed to add to Google Sheets:', error);
    // Don't throw - upload was successful, just sheet failed
  }

  return {
    folderId: folder.id,
    folderUrl: folder.webViewLink,
    uploadedFiles,
    sheetRowAdded,
  };
}

/**
 * Initialize the Google Sheet with headers if empty
 */
export async function initializeProductSheet(): Promise<void> {
  const headers = [
    'Timestamp',
    'Product ID',
    'EAN',
    'Name',
    'Gender',
    'Category',
    'Description',
    'SKU',
    'Price',
    'Drive Folder',
    'Image Count',
    'Image URLs',
  ];

  try {
    const { readSheet } = await import('./sheets');
    const existingData = await readSheet(`${getDefaultSheetName()}!A1:A1`);

    if (existingData.length === 0) {
      const { writeToSheet } = await import('./sheets');
      await writeToSheet([headers], `${getDefaultSheetName()}!A1`);
      console.log('Sheet headers initialized');
    }
  } catch (error) {
    console.error('Failed to initialize sheet:', error);
  }
}
