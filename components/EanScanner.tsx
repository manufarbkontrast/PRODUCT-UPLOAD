'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { EanLookupResult } from '@/config/ean-lookup-mappings';

interface EanScannerProps {
  readonly onScan: (ean: string) => void;
  readonly onSkip?: () => void;
  readonly onLookupResult?: (result: EanLookupResult) => void;
  readonly autoLookup?: boolean;
}

export default function EanScanner({ onScan, onSkip, onLookupResult, autoLookup = true }: EanScannerProps) {
  const [mode, setMode] = useState<'choice' | 'camera' | 'manual'>('choice');
  const [manualEan, setManualEan] = useState('');
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  }, []);

  const performLookup = useCallback(async (ean: string) => {
    if (!autoLookup || !onLookupResult) {
      return;
    }

    setLookingUp(true);
    setLookupStatus('searching');

    try {
      const res = await fetch('/api/ean-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ean }),
      });

      const data: EanLookupResult = await res.json();

      if (data.found) {
        setLookupStatus('found');
        onLookupResult(data);
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

  const detectBarcode = useCallback(async (video: HTMLVideoElement): Promise<string | null> => {
    // Use native BarcodeDetector API (Chrome, Edge, Opera, Android)
    if ('BarcodeDetector' in window) {
      try {
        // @ts-expect-error - BarcodeDetector is not yet in all TypeScript types
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          return barcodes[0].rawValue;
        }
      } catch {
        // BarcodeDetector failed, fall through to server
      }
    }

    // Fallback: Send frame to server API for processing
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    });

    if (!blob) return null;

    try {
      const formData = new FormData();
      formData.append('image', blob, 'scan.jpg');

      const res = await fetch('/api/scan-ean', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      return data.ean || null;
    } catch {
      return null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setScanning(true);

        // Auto-scan every 500ms
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;

          const ean = await detectBarcode(videoRef.current);
          if (ean) {
            stopCamera();
            handleEanDetected(ean);
          }
        }, 500);
      }
    } catch {
      setError('Kamera nicht verfügbar. Bitte manuell eingeben.');
      setMode('manual');
    }
  }, [detectBarcode, handleEanDetected, stopCamera]);

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [mode, stopCamera, startCamera]);

  const validateEan = (ean: string): boolean => {
    const cleaned = ean.replace(/\D/g, '');
    return cleaned.length >= 8 && cleaned.length <= 14;
  };

  const handleManualSubmit = () => {
    const cleaned = manualEan.replace(/\D/g, '');
    if (!validateEan(cleaned)) {
      setError('EAN muss 8-14 Ziffern haben');
      return;
    }
    handleEanDetected(cleaned);
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
          onClick={() => setMode('camera')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-900 text-white rounded-lg text-sm font-medium dark:bg-white dark:text-zinc-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Kamera öffnen
        </button>

        <button
          onClick={() => setMode('manual')}
          className="w-full py-3 px-4 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          EAN manuell eingeben
        </button>

        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Ohne EAN fortfahren
          </button>
        )}
      </div>
    );
  }

  // Camera mode — continuous auto-scan
  if (mode === 'camera') {
    return (
      <div className="space-y-3">
        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-3/4 h-16 border-2 border-white/50 rounded-lg" />
          </div>

          {/* Scanning indicator */}
          {scanning && cameraActive && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-white">Scanne automatisch...</span>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        <p className="text-xs text-zinc-500 text-center">
          Barcode im Rahmen positionieren — wird automatisch erkannt
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => setMode('manual')}
            className="flex-1 py-2.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Manuell eingeben
          </button>
          <button
            onClick={() => setMode('choice')}
            className="flex-1 py-2.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  // Manual mode
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
          EAN / Barcode-Nummer
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
          placeholder="z.B. 4012345678901"
          className="w-full px-3 py-2 text-base border rounded-lg bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          autoFocus
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>

      <button
        onClick={handleManualSubmit}
        disabled={!manualEan.trim() || lookingUp}
        className="w-full py-3 px-4 bg-zinc-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {lookingUp ? 'Suche...' : 'Weiter'}
      </button>

      <div className="flex gap-2">
        <button
          onClick={() => setMode('camera')}
          className="flex-1 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          Kamera nutzen
        </button>
        <button
          onClick={() => setMode('choice')}
          className="flex-1 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          Zurück
        </button>
      </div>

      {onSkip && (
        <button
          onClick={onSkip}
          className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Ohne EAN fortfahren
        </button>
      )}
    </div>
  );
}
