'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SHOE_VIEWS, getMissingViews, type ShoeView } from '@/config/shoe-views';
import { CAPTURE_CONTAINER_ASPECT, CAPTURE_JPEG_QUALITY } from '@/config/constants';
import { computeScanCropRect } from '@/lib/scan-crop';
import { classifyCameraError } from '@/lib/camera-errors';
import {
  start as startCapture,
  openCamera as openCameraStep,
  capture as captureStep,
  retake as retakeStep,
  confirm as confirmStep,
  backToInstructions,
  currentView,
  isComplete,
  type GuidedCaptureState,
} from '@/lib/guided-capture';
import CameraPermissionNotice, { type CameraErrorType } from '@/components/CameraPermissionNotice';
import { ShoeViewOverview } from '@/components/ShoeViewIndicator';
import { withBasePath } from '@/lib/base-path';

interface GuidedPhotoCaptureProps {
  readonly productId: string;
  /** sort_order der bereits vorhandenen Bilder — bestimmt, welche Ansichten fehlen. */
  readonly existingSortOrders: readonly number[];
  /** Wird nach jedem erfolgreichen Foto-Upload aufgerufen (z.B. Produkt neu laden). */
  readonly onUploadComplete?: () => void;
  /** Wird aufgerufen, sobald alle 4 Ansichten erfasst und die Verarbeitung gestartet wurde. */
  readonly onAllCaptured?: () => void;
  /** Schliesst den gefuehrten Flow (zurueck zur klassischen Ansicht). */
  readonly onCancel: () => void;
}

/** Konvertiert eine data: URL (aus canvas.toDataURL) in ein hochladbares File. */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = /data:(.*?);base64/.exec(header);
  const mime = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

export default function GuidedPhotoCapture({
  productId,
  existingSortOrders,
  onUploadComplete,
  onAllCaptured,
  onCancel,
}: GuidedPhotoCaptureProps) {
  // Die Liste der Ansichten, die diese Session durchlaufen muss — einmalig beim
  // Mount berechnet, damit der Flow stabil bleibt, auch wenn im Hintergrund neue
  // Bilder eintreffen (klassischer Upload parallel geoeffnet).
  const [views] = useState<readonly ShoeView[]>(() => getMissingViews(existingSortOrders));
  const [state, setState] = useState<GuidedCaptureState>(() => startCapture());
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraErrorType, setCameraErrorType] = useState<CameraErrorType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processTriggered, setProcessTriggered] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Bleibt waehrend der gesamten Lebensdauer der Komponente `true`, wird im
  // Unmount-Cleanup auf `false` gesetzt. Zusammen mit `requestIdRef` verhindert
  // das den Kamera-Leak: `getUserMedia()` kann waehrend eines haengenden
  // Berechtigungs-Dialogs lange auf sich warten lassen — laeuft der Nutzer in
  // der Zwischenzeit weg (Unmount) oder verlaesst die Aufnahme-Phase, darf der
  // erst danach aufgeloeste Stream NICHT mehr angehaengt werden, sondern muss
  // sofort wieder gestoppt werden (sonst bleibt die Kamera-LED dauerhaft an).
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const view = currentView(state, views);
  const complete = isComplete(state, views);

  const stopCamera = useCallback(() => {
    // Jeder laufende (noch nicht aufgeloeste) openLiveCamera()-Aufruf wird
    // hierdurch als veraltet markiert, siehe Guard in openLiveCamera().
    requestIdRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const openLiveCamera = useCallback(async () => {
    setCameraErrorType(null);
    const requestId = requestIdRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      // Guard gegen den Kamera-Leak: Komponente unmounted oder Aufnahme-Phase
      // verlassen (stopCamera() hat requestIdRef erhoeht), waehrend der
      // Berechtigungs-Dialog noch offen war. Der Stream ist dann veraltet —
      // sofort stoppen und NICHT an streamRef/video haengen.
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setCameraErrorType(classifyCameraError(err));
      }
    }
  }, []);

  // Mount/Unmount-Tracking fuer den Guard in openLiveCamera().
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (state.phase === 'aufnahme') {
      openLiveCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Nach Abschluss aller 4 Ansichten: bestehenden Gemini-Verarbeitungsschritt
  // ausloesen (identischer Aufruf wie app/products/[id]/images/page.tsx).
  useEffect(() => {
    if (!complete || processTriggered) return;
    setProcessTriggered(true);

    const triggerProcess = async () => {
      try {
        const res = await fetch(withBasePath(`/api/products/${productId}/process`), { method: 'POST' });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Fehler beim Starten der Verarbeitung');
        }
      } catch (err) {
        // Konsistent mit handleProcessImages (app/products/[id]/images/page.tsx):
        // bei Fehlschlag NICHT "Verarbeitung gestartet" behaupten, sondern den
        // Fehler sichtbar machen.
        const msg = err instanceof Error ? err.message : 'Fehler beim Starten der Verarbeitung';
        console.error('[GuidedPhotoCapture] Verarbeitung konnte nicht gestartet werden:', err);
        setProcessError(msg);
      } finally {
        onUploadComplete?.();
        onAllCaptured?.();
      }
    };

    triggerProcess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, processTriggered, productId]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    // Nur den sichtbaren (object-cover) Ausschnitt festhalten — genau das, was
    // der Mitarbeiter im aspect-[4/3]-Container inkl. Silhouette sieht. Gleiche
    // Geometrie wie EanScanner/lib/scan-crop.ts, hier mit widthPct/heightPct=1
    // (voller sichtbarer Ausschnitt statt kleinem Scan-Zielbereich).
    const { sx, sy, sw, sh } = computeScanCropRect(
      { videoWidth: vw, videoHeight: vh },
      CAPTURE_CONTAINER_ASPECT,
      1,
      1
    );

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    const dataUrl = canvas.toDataURL('image/jpeg', CAPTURE_JPEG_QUALITY);
    setState((prev) => captureStep(prev, dataUrl));
  }, []);

  const handleRetake = useCallback(() => {
    setUploadError(null);
    setState((prev) => retakeStep(prev));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!view || !state.capturedDataUrl) return;

    setUploading(true);
    setUploadError(null);

    try {
      const file = dataUrlToFile(state.capturedDataUrl, `${view.key}-${Date.now()}.jpg`);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sortOrder', String(view.sortOrder));

      const res = await fetch(withBasePath(`/api/products/${productId}/images`), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload fehlgeschlagen');
      }

      onUploadComplete?.();
      setState((prev) => confirmStep(prev, views));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  }, [productId, state.capturedDataUrl, view, views, onUploadComplete]);

  // Nichts zu tun — alle 4 Ansichten waren schon vor Sessionstart vorhanden.
  if (views.length === 0 && !complete) {
    return (
      <div className="space-y-4 text-center py-6">
        <p className="text-sm text-muted-foreground">
          Alle {SHOE_VIEWS.length} Standardansichten sind bereits vorhanden.
        </p>
        <button
          onClick={onCancel}
          className="w-full min-h-11 flex items-center justify-center py-3 px-4 border border-input rounded-lg text-sm font-medium hover:bg-muted"
        >
          Zurück
        </button>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-900/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">
            Alle 4 Ansichten aufgenommen
          </p>
          {processError ? (
            <p className="text-sm text-red-600 mt-1">{processError}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Verarbeitung wurde gestartet...</p>
          )}
        </div>

        <ShoeViewOverview
          images={SHOE_VIEWS.map((v) => ({ sortOrder: v.sortOrder }))}
        />

        <button
          onClick={onCancel}
          className="w-full min-h-11 flex items-center justify-center py-3 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          Fertig
        </button>
      </div>
    );
  }

  if (!view) return null;

  const doneOverall = SHOE_VIEWS.length - views.length + state.capturedViewIds.length;
  const photoNumber = Math.min(doneOverall + 1, SHOE_VIEWS.length);

  // Fuer die Fortschritts-Uebersicht: eine Ansicht gilt als erledigt, wenn sie
  // entweder schon vor Sessionstart vorhanden war (nicht Teil von `views`) oder
  // in dieser Session bereits bestaetigt wurde.
  const doneViewSortOrders = SHOE_VIEWS.filter(
    (v) => !views.some((missing) => missing.key === v.key) || state.capturedViewIds.includes(v.key)
  ).map((v) => ({ sortOrder: v.sortOrder }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Foto {photoNumber} von {SHOE_VIEWS.length}
        </p>
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground min-h-11 px-2"
        >
          Abbrechen
        </button>
      </div>

      {/* Step A: Anleitung */}
      {state.phase === 'anleitung' && (
        <div className="space-y-4 text-center">
          <div className="bg-muted/50 rounded-xl p-4">
            <img
              src={withBasePath(view.piktogramm)}
              alt={view.label}
              className="w-full max-w-[280px] mx-auto"
            />
          </div>
          <p className="text-sm font-medium text-foreground">{view.label}</p>
          <p className="text-sm text-muted-foreground">{view.anweisung}</p>
          <button
            onClick={() => setState((prev) => openCameraStep(prev))}
            className="w-full min-h-11 flex items-center justify-center gap-2 py-3 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Kamera öffnen
          </button>
        </div>
      )}

      {/* Step B: Aufnahme mit Silhouette-Overlay */}
      {state.phase === 'aufnahme' && (
        <div className="space-y-3">
          {cameraErrorType ? (
            <div className="space-y-3">
              <CameraPermissionNotice type={cameraErrorType} />
              <button
                onClick={() => setState((prev) => backToInstructions(prev))}
                className="w-full min-h-11 flex items-center justify-center py-3 px-4 border border-input rounded-lg text-sm font-medium hover:bg-muted"
              >
                Zurück zur Anleitung
              </button>
            </div>
          ) : (
            <>
              {/* aspect-[4/3] MUSS mit CAPTURE_CONTAINER_ASPECT uebereinstimmen. */}
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <img
                  src={withBasePath(view.silhouette)}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-contain opacity-40 pointer-events-none"
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">{view.anweisung}</p>

              <div className="flex justify-center pb-[env(safe-area-inset-bottom)]">
                <button
                  onClick={handleCapture}
                  disabled={!cameraActive}
                  aria-label="Foto aufnehmen"
                  className="w-16 h-16 rounded-full border-4 border-white bg-white disabled:opacity-40 shadow-lg"
                />
              </div>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Step C: Vorschau */}
      {state.phase === 'vorschau' && state.capturedDataUrl && (
        <div className="space-y-3">
          <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.capturedDataUrl}
              alt={`Vorschau: ${view.label}`}
              className="w-full h-full object-cover"
            />
          </div>

          {uploadError && (
            <p className="text-sm text-red-600 text-center">{uploadError}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRetake}
              disabled={uploading}
              className="flex-1 min-h-11 flex items-center justify-center py-2.5 text-sm border border-input rounded-lg hover:bg-muted disabled:opacity-50"
            >
              Wiederholen
            </button>
            <button
              onClick={handleConfirm}
              disabled={uploading}
              className="flex-1 min-h-11 flex items-center justify-center gap-2 py-2.5 text-sm bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {uploading ? 'Lädt hoch...' : 'Übernehmen'}
            </button>
          </div>
        </div>
      )}

      <ShoeViewOverview images={doneViewSortOrders} />
    </div>
  );
}
