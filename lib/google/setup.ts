import { getDriveClient } from './auth';

/**
 * In-memory cache for auto-created Google Drive folder ID.
 * Persists for the lifetime of the server process.
 */
let cachedDriveFolderId: string | null = null;

const ROOT_FOLDER_NAME = 'SPZ-Product-Integration';

/**
 * Search for an existing folder by name in Drive root.
 */
async function findFolderByName(name: string): Promise<string | null> {
  const drive = await getDriveClient();

  const response = await drive.files.list({
    q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });

  const files = response.data.files || [];
  return files.length > 0 ? files[0].id! : null;
}

/**
 * Ensure the root Drive folder exists.
 * If GOOGLE_DRIVE_FOLDER_ID is set in env, uses that.
 * Otherwise, searches for or creates the folder.
 */
export async function getOrCreateDriveFolderId(): Promise<string> {
  // 1. Check env var
  const envFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (envFolderId) {
    return envFolderId;
  }

  // 2. Check in-memory cache
  if (cachedDriveFolderId) {
    return cachedDriveFolderId;
  }

  // 3. Search for existing folder
  const existingId = await findFolderByName(ROOT_FOLDER_NAME);
  if (existingId) {
    console.log(`[GoogleSetup] Found existing Drive folder: ${ROOT_FOLDER_NAME} (${existingId})`);
    cachedDriveFolderId = existingId;
    return existingId;
  }

  // 4. Create new folder
  const drive = await getDriveClient();
  const response = await drive.files.create({
    requestBody: {
      name: ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  const newId = response.data.id!;
  console.log(`[GoogleSetup] Created Drive folder: ${ROOT_FOLDER_NAME} (${newId})`);
  cachedDriveFolderId = newId;
  return newId;
}
