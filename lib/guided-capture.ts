import type { ShoeView } from '@/config/shoe-views';

/**
 * Reine, unveraenderliche Zustandsmaschine fuer den gefuehrten Foto-Aufnahme-Flow
 * (Task 7). Kein DOM-/Kamera-Zugriff hier — nur Zustandsuebergaenge, damit sie ohne
 * Browser-Umgebung getestet werden koennen. `GuidedPhotoCapture.tsx` konsumiert diese
 * Funktionen und bleibt dadurch dünn (reine UI + Kamera-Wiring).
 */

export type GuidedCapturePhase = 'anleitung' | 'aufnahme' | 'vorschau';

export interface GuidedCaptureState {
  /** Index in die (extern bereitgestellte) Liste der ausstehenden Ansichten. */
  readonly stepIndex: number;
  readonly phase: GuidedCapturePhase;
  /** Keys (ShoeView.key) der in dieser Session bereits bestaetigten Ansichten. */
  readonly capturedViewIds: readonly string[];
  /** Zuletzt aufgenommenes, noch nicht bestaetigtes Foto (Vorschau-Phase). */
  readonly capturedDataUrl: string | null;
}

/** Startzustand: erster Schritt, Anleitungs-Phase, noch nichts aufgenommen. */
export function start(): GuidedCaptureState {
  return {
    stepIndex: 0,
    phase: 'anleitung',
    capturedViewIds: [],
    capturedDataUrl: null,
  };
}

/** Anleitung -> Live-Kamera oeffnen. */
export function openCamera(state: GuidedCaptureState): GuidedCaptureState {
  return { ...state, phase: 'aufnahme' };
}

/** Live-Kamera -> Vorschau des soeben aufgenommenen Fotos. */
export function capture(state: GuidedCaptureState, dataUrl: string): GuidedCaptureState {
  return { ...state, phase: 'vorschau', capturedDataUrl: dataUrl };
}

/** Vorschau verwerfen -> zurueck zur Live-Kamera, ohne den Schritt zu wechseln. */
export function retake(state: GuidedCaptureState): GuidedCaptureState {
  return { ...state, phase: 'aufnahme', capturedDataUrl: null };
}

/**
 * Von der Live-Kamera zurueck zur Anleitung (z.B. nach einem Kamera-Fehler,
 * bevor je ein Foto aufgenommen wurde) — ohne den Schritt zu wechseln.
 */
export function backToInstructions(state: GuidedCaptureState): GuidedCaptureState {
  return { ...state, phase: 'anleitung', capturedDataUrl: null };
}

/**
 * Foto bestaetigen: aktuelle Ansicht wird als erfasst vermerkt, danach springt der
 * Flow zur naechsten noch NICHT erfassten Ansicht in `views` (bereits erfasste
 * werden uebersprungen — Verteidigung gegen Randfaelle, in denen `views` eine
 * bereits bestaetigte Ansicht enthaelt).
 */
export function confirm(state: GuidedCaptureState, views: readonly ShoeView[]): GuidedCaptureState {
  const current = views[state.stepIndex];
  const capturedViewIds =
    current && !state.capturedViewIds.includes(current.key)
      ? [...state.capturedViewIds, current.key]
      : state.capturedViewIds;

  let nextIndex = state.stepIndex + 1;
  while (nextIndex < views.length && capturedViewIds.includes(views[nextIndex].key)) {
    nextIndex += 1;
  }

  return {
    stepIndex: nextIndex,
    phase: 'anleitung',
    capturedViewIds,
    capturedDataUrl: null,
  };
}

/** Selektor: die aktuell aktive Ansicht, oder undefined wenn der Flow abgeschlossen ist. */
export function currentView(
  state: GuidedCaptureState,
  views: readonly ShoeView[]
): ShoeView | undefined {
  return views[state.stepIndex];
}

/** Selektor: true, sobald jede Ansicht aus `views` als erfasst vermerkt ist. */
export function isComplete(state: GuidedCaptureState, views: readonly ShoeView[]): boolean {
  return views.every((v) => state.capturedViewIds.includes(v.key));
}
