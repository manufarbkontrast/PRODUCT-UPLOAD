// Google API Integration
// Export all Google Drive functions

export { GOOGLE_CONFIG } from './config';

export {
  getOrCreateDriveFolderId,
} from './setup';

export {
  getGoogleAuth,
  getDriveClient,
  getOAuth2Client,
  getAuthUrl,
  getTokensFromCode,
  loadSavedTokens,
  isOAuth2Ready,
  getAuthStatus,
} from './auth';

export {
  uploadFile,
  uploadImage,
  listFiles,
  getFile,
  downloadFile,
  deleteFile,
  createFolder,
  makeFilePublic,
  type UploadResult,
  type FileInfo,
} from './drive';

export {
  uploadProductToDrive,
  type ProductUploadData,
  type ProductUploadResult,
} from './product-upload';
