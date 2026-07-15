/**
 * Application-wide timing and configuration constants.
 * Centralizes magic numbers for easier tuning and documentation.
 */

/** Interval (ms) between barcode detection attempts in camera mode */
export const BARCODE_SCAN_INTERVAL_MS = 500;

/**
 * Scan-Zielbereich (Anteil der Videobreite/-hoehe), einhaendig gut zu treffen.
 * WICHTIG: Wird sowohl vom visuellen Overlay als auch vom Crop der Scan-Logik
 * genutzt — beide MUESSEN diese Werte teilen, sonst laufen Anzeige und
 * tatsaechlich gescannter Bereich auseinander.
 */
export const SCAN_REGION_WIDTH_PCT = 0.86;
export const SCAN_REGION_HEIGHT_PCT = 0.42;

/**
 * Seitenverhaeltnis des Video-Containers in EanScanner.tsx (Tailwind
 * `aspect-[4/3]`). Der Container ist fix (nicht responsiv), daher genuegt
 * eine geteilte Konstante statt einer DOM-Messung zur Laufzeit — beide
 * Stellen MUESSEN denselben Wert nutzen, sonst weicht der fuer die
 * Barcode-Erkennung gecroppte Bereich vom sichtbaren object-cover-Fenster ab
 * (siehe lib/scan-crop.ts).
 */
export const SCAN_CONTAINER_ASPECT = 4 / 3;

/** Dauer (ms) des gruenen Erfolgs-Overlays nach erkanntem Barcode */
export const SCAN_SUCCESS_FLASH_MS = 650;

/** WebAudio-Piepton bei erkanntem Barcode (Frequenz in Hz, Dauer in Sekunden) */
export const SCAN_BEEP_FREQUENCY_HZ = 880;
export const SCAN_BEEP_DURATION_S = 0.12;

/**
 * Seitenverhaeltnis des Video-Containers in GuidedPhotoCapture.tsx (Tailwind
 * `aspect-[4/3]`) — bewusst getrennt von SCAN_CONTAINER_ASPECT (EanScanner),
 * obwohl der Wert zufaellig identisch ist, damit beide Komponenten unabhaengig
 * voneinander angepasst werden koennen.
 */
export const CAPTURE_CONTAINER_ASPECT = 4 / 3;

/** JPEG-Qualitaet (0-1) beim Export des aufgenommenen Fotos aus dem Canvas. */
export const CAPTURE_JPEG_QUALITY = 0.9;

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
