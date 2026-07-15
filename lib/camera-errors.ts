import type { CameraErrorType } from '@/components/CameraPermissionNotice';

/**
 * Ermittelt den Fehlertyp aus einem getUserMedia-Fehler fuer passgenaue Hilfetexte.
 *
 * Extrahiert aus EanScanner.tsx (Task 7, DRY) — reine Funktion ohne Seiteneffekte,
 * damit sie unabhaengig von DOM/Camera-State getestet werden kann. EanScanner.tsx
 * behaelt vorerst seine eigene Kopie, um dessen bereits verifizierte Kamera-Geometrie
 * nicht anzufassen; neue Komponenten (z.B. GuidedPhotoCapture) importieren diese hier.
 */
export function classifyCameraError(err: unknown): CameraErrorType {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'denied';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'unavailable';
  }
  return 'other';
}
