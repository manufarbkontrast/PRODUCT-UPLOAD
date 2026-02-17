/**
 * Application-wide timing and configuration constants.
 * Centralizes magic numbers for easier tuning and documentation.
 */

/** Interval (ms) between barcode detection attempts in camera mode */
export const BARCODE_SCAN_INTERVAL_MS = 500;

/** Interval (ms) between product status polling requests */
export const PRODUCT_POLL_INTERVAL_MS = 5000;

/** Interval (ms) between image page polling requests */
export const IMAGE_POLL_INTERVAL_MS = 3000;

/** Timeout (ms) for n8n health check before falling back to direct processing */
export const N8N_HEALTH_CHECK_TIMEOUT_MS = 2000;

/** Delay (ms) between retry attempts for image downloads */
export const IMAGE_DOWNLOAD_RETRY_DELAY_MS = 1000;

/** Maximum number of retry attempts for image downloads */
export const IMAGE_DOWNLOAD_MAX_RETRIES = 3;
