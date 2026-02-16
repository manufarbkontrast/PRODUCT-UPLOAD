// Google Drive Configuration
// Static defaults used when env vars aren't set.
// For auto-creation logic, see setup.ts

export const GOOGLE_CONFIG = {
  DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  DRIVE_FOLDER_NAME: 'SPZ-Product-Integration',
} as const;
