// Google API Integration
// Export all Google Drive and Sheets functions

export { GOOGLE_CONFIG } from './config';

export {
  getOrCreateDriveFolderId,
  getOrCreateSpreadsheetId,
  getDefaultSheetName,
  SHEET_HEADERS,
} from './setup';

export {
  getGoogleAuth,
  getDriveClient,
  getSheetsClient,
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
  readSheet,
  readSheetAsObjects,
  appendToSheet,
  writeToSheet,
  clearSheet,
  getSheetInfo,
  createSheet,
  deleteSheet,
  findRowByValue,
  updateRow,
  type SheetRow,
} from './sheets';

export {
  uploadProductToDrive,
  initializeProductSheet,
  type ProductUploadData,
  type ProductUploadResult,
} from './product-upload';
