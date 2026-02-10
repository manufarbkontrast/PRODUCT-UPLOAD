import { getDriveClient } from './auth';
import { getOrCreateDriveFolderId } from './setup';
import { Readable } from 'stream';

export interface UploadResult {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink: string;
}

export interface FileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink: string;
}

/**
 * Upload a file to Google Drive.
 */
export async function uploadFile(
  fileName: string,
  mimeType: string,
  content: Buffer | Readable,
  folderId?: string
): Promise<UploadResult> {
  const drive = await getDriveClient();
  const parentId = folderId || await getOrCreateDriveFolderId();

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: content instanceof Buffer ? Readable.from(content) : content,
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
    webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
    webContentLink: response.data.webContentLink || '',
  };
}

/**
 * Upload an image to Google Drive.
 */
export async function uploadImage(
  fileName: string,
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg',
  folderId?: string
): Promise<UploadResult> {
  return uploadFile(fileName, mimeType, imageBuffer, folderId);
}

/**
 * List files in a folder.
 */
export async function listFiles(
  folderId?: string,
  pageSize: number = 100
): Promise<FileInfo[]> {
  const drive = await getDriveClient();
  const parentId = folderId || await getOrCreateDriveFolderId();

  const response = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    pageSize,
    fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink)',
  });

  return (response.data.files || []).map((file) => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    size: file.size || '0',
    createdTime: file.createdTime!,
    modifiedTime: file.modifiedTime!,
    webViewLink: file.webViewLink || '',
    webContentLink: file.webContentLink || '',
  }));
}

/**
 * Get file by ID.
 */
export async function getFile(fileId: string): Promise<FileInfo | null> {
  const drive = await getDriveClient();

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      size: response.data.size || '0',
      createdTime: response.data.createdTime!,
      modifiedTime: response.data.modifiedTime!,
      webViewLink: response.data.webViewLink || '',
      webContentLink: response.data.webContentLink || '',
    };
  } catch {
    return null;
  }
}

/**
 * Download file content.
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = await getDriveClient();

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Delete a file.
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  const drive = await getDriveClient();

  try {
    await drive.files.delete({ fileId });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a folder in Google Drive.
 */
export async function createFolder(
  folderName: string,
  parentFolderId?: string
): Promise<UploadResult> {
  const drive = await getDriveClient();
  const parentId = parentFolderId || await getOrCreateDriveFolderId();

  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
    webViewLink: response.data.webViewLink || `https://drive.google.com/drive/folders/${response.data.id}`,
    webContentLink: response.data.webContentLink || '',
  };
}

/**
 * Make a file publicly accessible.
 */
export async function makeFilePublic(fileId: string): Promise<void> {
  const drive = await getDriveClient();

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });
}
