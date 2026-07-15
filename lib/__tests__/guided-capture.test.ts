import { describe, it, expect } from 'vitest';
import {
  start,
  openCamera,
  capture,
  retake,
  confirm,
  currentView,
  isComplete,
  backToInstructions,
} from '@/lib/guided-capture';
import { classifyCameraError } from '@/lib/camera-errors';
import { SHOE_VIEWS, getMissingViews } from '@/config/shoe-views';

describe('guided-capture state machine', () => {
  it('starts at the first missing view', () => {
    // sortOrder 0 (seite_aussen) und 2 (schraeg_vorne) bereits vorhanden -> Reihenfolge:
    // sohle (1), paar_profil (3)
    const missing = getMissingViews([0, 2]);
    const state = start();

    expect(state.phase).toBe('anleitung');
    expect(state.capturedViewIds).toEqual([]);
    expect(currentView(state, missing)?.key).toBe('sohle');
  });

  it('starts at the very first canonical view when nothing exists yet', () => {
    const missing = getMissingViews([]);
    const state = start();

    expect(currentView(state, missing)?.key).toBe(SHOE_VIEWS[0].key);
  });

  it('openCamera transitions anleitung -> aufnahme without touching progress', () => {
    const state = openCamera(start());
    expect(state.phase).toBe('aufnahme');
    expect(state.stepIndex).toBe(0);
    expect(state.capturedViewIds).toEqual([]);
  });

  it('capture transitions aufnahme -> vorschau and stores the data URL', () => {
    const state = capture(openCamera(start()), 'data:image/jpeg;base64,AAA');
    expect(state.phase).toBe('vorschau');
    expect(state.capturedDataUrl).toBe('data:image/jpeg;base64,AAA');
  });

  it('retake returns to aufnahme without advancing the step or recording progress', () => {
    const beforeRetake = capture(openCamera(start()), 'data:image/jpeg;base64,AAA');
    const afterRetake = retake(beforeRetake);

    expect(afterRetake.phase).toBe('aufnahme');
    expect(afterRetake.capturedDataUrl).toBeNull();
    expect(afterRetake.stepIndex).toBe(beforeRetake.stepIndex);
    expect(afterRetake.capturedViewIds).toEqual(beforeRetake.capturedViewIds);
  });

  it('confirm advances to the next missing view and records the captured id', () => {
    const missing = getMissingViews([]); // all 4, in canonical order
    let state = start();
    state = openCamera(state);
    state = capture(state, 'data:image/jpeg;base64,AAA');
    state = confirm(state, missing);

    expect(state.phase).toBe('anleitung');
    expect(state.capturedViewIds).toEqual(['seite_aussen']);
    expect(currentView(state, missing)?.key).toBe('sohle');
  });

  it('confirm skips views that are already captured', () => {
    const missing = getMissingViews([]);
    // Simulate a stale/edge-case state where the 2nd view (sohle) somehow is
    // already marked captured before we confirm the 1st (seite_aussen).
    const stateBeforeConfirm = {
      stepIndex: 0,
      phase: 'vorschau' as const,
      capturedViewIds: ['sohle'],
      capturedDataUrl: 'data:image/jpeg;base64,AAA',
    };

    const state = confirm(stateBeforeConfirm, missing);

    expect(state.capturedViewIds).toEqual(['sohle', 'seite_aussen']);
    // sohle (index 1) must be skipped since it is already captured
    expect(currentView(state, missing)?.key).toBe('schraeg_vorne');
  });

  it('confirm is pure — calling it twice with the same unchanged input yields the same result', () => {
    const missing = getMissingViews([]);
    const captured = capture(openCamera(start()), 'x');
    const state = confirm(captured, missing);
    const stateAgain = confirm(captured, missing);
    expect(stateAgain.capturedViewIds).toEqual(['seite_aussen']);
    expect(state.capturedViewIds).toEqual(['seite_aussen']);
    // the original input must remain untouched (immutability)
    expect(captured.capturedViewIds).toEqual([]);
  });

  it('isComplete is false until all 4 canonical views are captured', () => {
    const missing = getMissingViews([]);
    let state = start();

    for (const view of missing.slice(0, 3)) {
      state = confirm(capture(openCamera({ ...state, phase: 'anleitung' }), 'x'), missing);
      expect(isComplete(state, SHOE_VIEWS)).toBe(false);
      void view;
    }

    state = confirm(capture(openCamera({ ...state, phase: 'anleitung' }), 'x'), missing);
    expect(isComplete(state, SHOE_VIEWS)).toBe(true);
    expect(currentView(state, missing)).toBeUndefined();
  });

  it('backToInstructions returns to anleitung without advancing or clearing progress', () => {
    const state = backToInstructions(openCamera(start()));
    expect(state.phase).toBe('anleitung');
    expect(state.stepIndex).toBe(0);
    expect(state.capturedViewIds).toEqual([]);
    expect(state.capturedDataUrl).toBeNull();
  });

  it('never mutates the input state object (immutability)', () => {
    const initial = start();
    const frozen = Object.freeze({ ...initial, capturedViewIds: Object.freeze([...initial.capturedViewIds]) });
    expect(() => openCamera(frozen)).not.toThrow();
    expect(() => capture(frozen, 'x')).not.toThrow();
  });
});

describe('classifyCameraError', () => {
  it('maps NotAllowedError to denied', () => {
    expect(classifyCameraError(new DOMException('nope', 'NotAllowedError'))).toBe('denied');
  });

  it('maps PermissionDeniedError to denied', () => {
    expect(classifyCameraError(new DOMException('nope', 'PermissionDeniedError'))).toBe('denied');
  });

  it('maps SecurityError to denied', () => {
    expect(classifyCameraError(new DOMException('nope', 'SecurityError'))).toBe('denied');
  });

  it('maps NotFoundError to unavailable', () => {
    expect(classifyCameraError(new DOMException('nope', 'NotFoundError'))).toBe('unavailable');
  });

  it('maps DevicesNotFoundError to unavailable', () => {
    expect(classifyCameraError(new DOMException('nope', 'DevicesNotFoundError'))).toBe('unavailable');
  });

  it('maps OverconstrainedError to unavailable', () => {
    expect(classifyCameraError(new DOMException('nope', 'OverconstrainedError'))).toBe('unavailable');
  });

  it('maps unknown DOMExceptions and plain errors to other', () => {
    expect(classifyCameraError(new DOMException('nope', 'AbortError'))).toBe('other');
    expect(classifyCameraError(new Error('boom'))).toBe('other');
    expect(classifyCameraError('not-an-error')).toBe('other');
  });
});
