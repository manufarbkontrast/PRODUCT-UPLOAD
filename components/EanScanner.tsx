'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { EanLookupResult } from '@/config/ean-lookup-mappings';
import type { JtlArticle } from '@/lib/jtl/cache';
import {
  BARCODE_SCAN_INTERVAL_MS,
  SCAN_BEEP_DURATION_S,
  SCAN_BEEP_FREQUENCY_HZ,
  SCAN_CONTAINER_ASPECT,
  SCAN_REGION_HEIGHT_PCT,
  SCAN_REGION_WIDTH_PCT,
  SCAN_SUCCESS_FLASH_MS,
} from '@/config/constants';
import CameraPermissionNotice, { type CameraErrorType } from '@/components/CameraPermissionNotice';
import EanScannerOverlay from '@/components/EanScannerOverlay';
import { computeScanCropRect } from '@/lib/scan-crop';

interface JtlLookupResponse {
  readonly found: boolean;
  readonly article?: JtlArticle;
  readonly variants?: readonly JtlArticle[];
  readonly totalStock?: number;
}

const SOUND_PREFERENCE_KEY = 'ean-scanner-sound-enabled';

/** Extrahiert die Groesse aus einer JTL-SKU (letztes Segment nach dem letzten "-"). */
function extractSizeFromSku(sku: string): string {
  const lastDash = sku.lastIndexOf('-');
  return lastDash === -1 ? '' : sku.substring(lastDash + 1);
}

/** Mappt die /api/jtl-lookup Antwort auf das von der UI erwartete EanLookupResult-Format. */
function mapJtlResultToLookup(data: JtlLookupResponse): EanLookupResult {
  const article = data.article;
  if (!data.found || !article) return { found: false };

  const price = article.suggestedRetailPrice > 0
    ? article.suggestedRetailPrice.toFixed(2)
    : article.salesPriceNet > 0
      ? article.salesPriceNet.toFixed(2)
      : undefined;

  return {
    found: true,
    source: 'jtl',
    name: article.name,
    sku: article.sku,
    barcode: article.gtin || undefined,
    price,
    size: extractSizeFromSku(article.sku),
    inventoryQuantity: data.totalStock ?? article.availableStock,
    confidence: 'high',
    variants: (data.variants ?? []).map((v) => ({
      sku: v.sku,
      size: extractSizeFromSku(v.sku),
      stock: v.availableStock,
      ean: v.gtin,
    })),
  };
}

/** Ermittelt den Fehlertyp aus einem getUserMedia-Fehler fuer passgenaue Hilfetexte. */
function classifyCameraError(err: unknown): CameraErrorType {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'denied';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'unavailable';
  }
  return 'other';
}

interface EanScannerProps {
  readonly onScan: (ean: string) => void;
  readonly onSkip?: () => void;
  readonly onLookupResult?: (result: EanLookupResult) => void;
  readonly autoLookup?: boolean;
}

type BarcodeDetectorInstance = {
  detect: (source: HTMLCanvasElement | HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

export default function EanScanner({ onScan, onSkip, onLookupResult, autoLookup = true }: EanScannerProps) {
  const [mode, setMode] = useState<'choice' | 'permission' | 'camera' | 'confirm' | 'manual'>('choice');
  const [manualEan, setManualEan] = useState('');
  const [detectedEan, setDetectedEan] = useState('');
  const [error, setError] = useState('');
  const [cameraErrorType, setCameraErrorType] = useState<CameraErrorType | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [successFlash, setSuccessFlash] = useState(false);
  const [flashEan, setFlashEan] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eanLockedRef = useRef(false);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const permissionPrimedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SOUND_PREFERENCE_KEY);
      if (stored === 'off') setSoundEnabled(false);
    } catch {
      // localStorage nicht verfuegbar (z.B. privater Modus) — Standard bleibt an
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SOUND_PREFERENCE_KEY, next ? 'on' : 'off');
      } catch {
        // ignore persist failure
      }
      return next;
    });
  }, []);

  /** Kurzer Piepton via WebAudio bei erkanntem Code — failsafe, iOS ignoriert vibrate(). */
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = SCAN_BEEP_FREQUENCY_HZ;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + SCAN_BEEP_DURATION_S);
      osc.onended = () => ctx.close().catch(() => {});
    } catch {
      // WebAudio nicht verfuegbar/blockiert — still weitermachen, kein Absturz
    }
  }, [soundEnabled]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setScanning(false);
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const performLookup = useCallback(async (ean: string) => {
    if (!autoLookup || !onLookupResult) {
      return;
    }

    setLookingUp(true);
    setLookupStatus('searching');

    try {
      const res = await fetch('/api/jtl-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ean }),
      });

      const data: JtlLookupResponse = await res.json();
      const mapped = mapJtlResultToLookup(data);

      if (mapped.found) {
        setLookupStatus('found');
        onLookupResult(mapped);
      } else {
        setLookupStatus('not_found');
        onLookupResult({ found: false });
      }
    } catch {
      setLookupStatus('not_found');
      onLookupResult({ found: false });
    } finally {
      setLookingUp(false);
    }
  }, [autoLookup, onLookupResult]);

  const handleEanDetected = useCallback((ean: string) => {
    onScan(ean);
    performLookup(ean);
  }, [onScan, performLookup]);

  // Returns cached BarcodeDetector — native or ZXing polyfill
  const getDetector = useCallback(async (): Promise<BarcodeDetectorInstance> => {
    if (detectorRef.current) return detectorRef.current;

    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

    if ('BarcodeDetector' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detectorRef.current = new (window as any).BarcodeDetector({ formats });
    } else {
      // ZXing-based polyfill — runs fully client-side, no API call needed
      const { BarcodeDetector: ZXingDetector } = await import('barcode-detector/pure');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detectorRef.current = new (ZXingDetector as any)({ formats });
    }

    return detectorRef.current!;
  }, []);

  // Crop-Bereich MUSS mit dem visuellen Overlay (EanScannerOverlay) uebereinstimmen.
  // Das <video> wird per object-cover in einen SCAN_CONTAINER_ASPECT-Container
  // (aspect-[4/3]) skaliert, wodurch bei abweichendem Kamera-Seitenverhaeltnis
  // (z.B. 16:9) nur ein zentrierter Ausschnitt des Rohbilds sichtbar ist. Das
  // Overlay positioniert SCAN_REGION_*_PCT relativ zu diesem sichtbaren
  // Ausschnitt — der Crop fuer die Barcode-Erkennung muss das ebenfalls tun,
  // sonst liest er einen groesseren/verschobenen Bereich als der Nutzer sieht.
  // Die eigentliche Geometrie steckt in lib/scan-crop.ts (mit eigenen Tests).
  const cropToScanRegion = useCallback((video: HTMLVideoElement): HTMLCanvasElement | null => {
    const canvas = canvasRef.current || document.createElement('canvas');
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return null;

    const { sx, sy, sw, sh } = computeScanCropRect(
      { videoWidth: vw, videoHeight: vh },
      SCAN_CONTAINER_ASPECT,
      SCAN_REGION_WIDTH_PCT,
      SCAN_REGION_HEIGHT_PCT
    );

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas;
  }, []);

  const detectBarcode = useCallback(async (video: HTMLVideoElement): Promise<string | null> => {
    const cropped = cropToScanRegion(video);

    try {
      const detector = await getDetector();
      const source = cropped || video;
      const barcodes = await detector.detect(source);
      if (barcodes.length > 0) {
        return barcodes[0].rawValue;
      }
    } catch {
      // detection failed
    }

    return null;
  }, [cropToScanRegion, getDetector]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      // torch not supported on this device
    }
  }, [torchOn]);

  const startCamera = useCallback(async () => {
    setError('');
    setCameraErrorType(null);
    permissionPrimedRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;

      // Check torch availability
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
      setTorchAvailable(!!capabilities.torch);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setScanning(true);

        eanLockedRef.current = false;
        scanIntervalRef.current = setInterval(async () => {
          if (eanLockedRef.current) return;
          if (!videoRef.current || videoRef.current.readyState < 2) return;

          const ean = await detectBarcode(videoRef.current);
          if (ean && !eanLockedRef.current) {
            eanLockedRef.current = true;
            navigator.vibrate?.(100);
            playBeep();
            setFlashEan(ean);
            setSuccessFlash(true);
            stopCamera();
            setDetectedEan(ean);

            flashTimeoutRef.current = setTimeout(() => {
              setSuccessFlash(false);
              setMode('confirm');
            }, SCAN_SUCCESS_FLASH_MS);
          }
        }, BARCODE_SCAN_INTERVAL_MS);
      }
    } catch (err) {
      const type = classifyCameraError(err);
      setCameraErrorType(type);
      setError(
        type === 'denied'
          ? 'Kamerazugriff wurde verweigert.'
          : type === 'unavailable'
            ? 'Keine Kamera gefunden.'
            : 'Kamera nicht verfügbar. Bitte manuell eingeben.'
      );
      setMode('manual');
    }
  }, [detectBarcode, playBeep, stopCamera]);

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const validateEan = (ean: string): boolean => {
    const trimmed = ean.trim();
    return trimmed.length >= 3;
  };

  const handleManualSubmit = () => {
    const trimmed = manualEan.trim();
    if (!validateEan(trimmed)) {
      setError('Artikelnummer muss mindestens 3 Zeichen haben');
      return;
    }
    handleEanDetected(trimmed);
  };

  /** Oeffnet die Kamera — zeigt vor dem allerersten getUserMedia-Aufruf einen erklaerenden Hinweis. */
  const handleRequestCamera = () => {
    setError('');
    if (permissionPrimedRef.current) {
      setMode('camera');
    } else {
      setMode('permission');
    }
  };

  // Lookup Status Overlay
  if (lookingUp || lookupStatus === 'found') {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          {lookupStatus === 'searching' && (
            <>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-500 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Suche Produktdaten...
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Durchsuche das Internet nach EAN-Informationen
              </p>
            </>
          )}
          {lookupStatus === 'found' && (
            <>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Produktdaten gefunden!
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Produkt wird erstellt...
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Choice screen
  if (mode === 'choice') {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            EAN/Barcode vom Hangtag scannen
          </p>
          {autoLookup && onLookupResult && (
            <p className="text-xs text-blue-500 mt-1">
              Produktdaten werden automatisch gesucht
            </p>
          )}
        </div>

        <button
          onClick={handleRequestCamera}
          className="w-full min-h-11 flex items-center justify-center gap-2 py-3 px-4 bg-zinc-900 text-white rounded-lg text-sm font-medium dark:bg-white dark:text-zinc-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Kamera öffnen
        </button>

        <button
          onClick={() => setMode('manual')}
          className="w-full min-h-11 flex items-center justify-center py-3 px-4 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          EAN manuell eingeben
        </button>

        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full min-h-11 flex items-center justify-center py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Ohne EAN fortfahren
          </button>
        )}
      </div>
    );
  }

  // Permission priming screen — erklaert VOR dem ersten getUserMedia, wofuer die Kamera gebraucht wird
  if (mode === 'permission') {
    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Für den Scan Kamera erlauben
          </p>
          <p className="text-xs text-zinc-500 mt-2 max-w-xs mx-auto">
            Die Kamera wird nur zum Scannen des Barcodes verwendet — es werden keine Fotos gespeichert.
          </p>
        </div>

        {cameraErrorType && <CameraPermissionNotice type={cameraErrorType} />}

        <button
          onClick={() => setMode('camera')}
          className="w-full min-h-11 flex items-center justify-center gap-2 py-3 px-4 bg-zinc-900 text-white rounded-lg text-sm font-medium dark:bg-white dark:text-zinc-900"
        >
          Kamera erlauben
        </button>

        <button
          onClick={() => setMode('manual')}
          className="w-full min-h-11 flex items-center justify-center py-3 px-4 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          Lieber manuell eingeben
        </button>
      </div>
    );
  }

  // Confirm mode
  if (mode === 'confirm') {
    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-500 mb-2">Erkannter Code:</p>
          <p className="text-2xl font-bold font-mono tracking-wider text-zinc-900 dark:text-white">
            {detectedEan}
          </p>
        </div>

        <button
          onClick={() => handleEanDetected(detectedEan)}
          className="w-full min-h-11 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Stimmt — weiter
        </button>

        <button
          onClick={() => {
            setDetectedEan('');
            eanLockedRef.current = false;
            setMode('camera');
          }}
          className="w-full min-h-11 flex items-center justify-center py-3 px-4 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          Falsch — nochmal scannen
        </button>

        <button
          onClick={() => {
            setManualEan(detectedEan);
            setMode('manual');
          }}
          className="w-full min-h-11 flex items-center justify-center py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Code korrigieren
        </button>
      </div>
    );
  }

  // Camera mode
  if (mode === 'camera') {
    return (
      <div className="space-y-3">
        {/* aspect-[4/3] MUSS mit SCAN_CONTAINER_ASPECT (config/constants.ts) uebereinstimmen —
            der Crop in cropToScanRegion() rechnet mit diesem Seitenverhaeltnis. */}
        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          <EanScannerOverlay
            scanning={scanning}
            cameraActive={cameraActive}
            torchAvailable={torchAvailable}
            torchOn={torchOn}
            onToggleTorch={toggleTorch}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            successFlash={successFlash}
            flashEan={flashEan}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <p className="text-xs text-zinc-500 text-center">
          Barcode mittig im Rahmen halten — wird automatisch erkannt
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => setMode('manual')}
            className="flex-1 min-h-11 flex items-center justify-center py-2.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Manuell eingeben
          </button>
          <button
            onClick={() => setMode('choice')}
            className="flex-1 min-h-11 flex items-center justify-center py-2.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  // Manual mode — vollwertige Alternative zum Kamera-Scan, nicht nur Fallback
  return (
    <div className="space-y-4">
      {cameraErrorType && <CameraPermissionNotice type={cameraErrorType} />}

      <div>
        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
          EAN / Artikelnummer
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={manualEan}
          onChange={(e) => {
            setManualEan(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleManualSubmit();
          }}
          placeholder="z.B. 4012345678901 oder eigene Nr."
          className="w-full min-h-11 px-3 py-2 text-base border rounded-lg bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          autoFocus
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>

      <button
        onClick={handleManualSubmit}
        disabled={!manualEan.trim() || lookingUp}
        className="w-full min-h-11 flex items-center justify-center py-3 px-4 bg-zinc-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {lookingUp ? 'Suche...' : 'Suchen'}
      </button>

      <div className="flex gap-2">
        <button
          onClick={handleRequestCamera}
          className="flex-1 min-h-11 flex items-center justify-center py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          Kamera nutzen
        </button>
        <button
          onClick={() => setMode('choice')}
          className="flex-1 min-h-11 flex items-center justify-center py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          Zurück
        </button>
      </div>

      {onSkip && (
        <button
          onClick={onSkip}
          className="w-full min-h-11 flex items-center justify-center py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Ohne EAN fortfahren
        </button>
      )}
    </div>
  );
}
