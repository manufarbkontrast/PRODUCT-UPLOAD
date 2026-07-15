import type { CSSProperties } from 'react';
import { SCAN_REGION_HEIGHT_PCT, SCAN_REGION_WIDTH_PCT } from '@/config/constants';

const SIDE_INSET_PCT = ((1 - SCAN_REGION_WIDTH_PCT) / 2) * 100;
const VERTICAL_INSET_PCT = ((1 - SCAN_REGION_HEIGHT_PCT) / 2) * 100;

/** Position/Groesse des Scan-Ziels — identisch fuer Overlay-Anzeige und Crop-Logik. */
const REGION_STYLE: CSSProperties = {
  left: `${SIDE_INSET_PCT}%`,
  right: `${SIDE_INSET_PCT}%`,
  top: `${VERTICAL_INSET_PCT}%`,
  bottom: `${VERTICAL_INSET_PCT}%`,
};

const CORNER_BASE = 'absolute w-8 h-8 border-white';

interface EanScannerOverlayProps {
  readonly scanning: boolean;
  readonly cameraActive: boolean;
  readonly torchAvailable: boolean;
  readonly torchOn: boolean;
  readonly onToggleTorch: () => void;
  readonly soundEnabled: boolean;
  readonly onToggleSound: () => void;
  readonly successFlash: boolean;
  readonly flashEan: string;
}

/** Visuelles Scan-Overlay: grosses mittiges Ziel, Statusanzeigen, Erfolgs-Blitz. */
export default function EanScannerOverlay({
  scanning,
  cameraActive,
  torchAvailable,
  torchOn,
  onToggleTorch,
  soundEnabled,
  onToggleSound,
  successFlash,
  flashEan,
}: EanScannerOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Darkened area outside scan region */}
      <div style={{ ...REGION_STYLE, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} className="absolute bg-transparent rounded-2xl" />

      {/* Grosses Ziel-Overlay mit Eckmarkierungen — gut einhaendig zu treffen */}
      <div style={REGION_STYLE} className="absolute rounded-2xl">
        <div className={`${CORNER_BASE} top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl`} />
        <div className={`${CORNER_BASE} top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl`} />
        <div className={`${CORNER_BASE} bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl`} />
        <div className={`${CORNER_BASE} bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl`} />
        {scanning && (
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500/70 animate-pulse" />
        )}
      </div>

      {/* Scanning indicator */}
      {scanning && cameraActive && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-white">Scanne automatisch...</span>
        </div>
      )}

      {/* Torch + Sound buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onToggleSound}
          className="flex items-center justify-center w-11 h-11 rounded-full bg-black/60 text-white"
          aria-label={soundEnabled ? 'Ton ausschalten' : 'Ton einschalten'}
        >
          {soundEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M6 9v6h4l5 5V4l-5 5H6z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M6 9v6h4l5 5V4l-5 5H6z" />
            </svg>
          )}
        </button>

        {torchAvailable && (
          <button
            onClick={onToggleTorch}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-black/60 text-white"
            aria-label={torchOn ? 'Licht ausschalten' : 'Licht einschalten'}
          >
            {torchOn ? (
              <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Erfolgs-Blitz: gruener Voll-Overlay + Haekchen + erkannter Code */}
      <div
        aria-hidden={!successFlash}
        className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-green-600/95 transition-opacity duration-150 ${
          successFlash ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-xl font-bold font-mono tracking-wider text-white">{flashEan}</p>
      </div>
    </div>
  );
}
