import { describe, it, expect, afterEach } from 'vitest';
import { withBasePath } from '@/lib/base-path';

describe('withBasePath', () => {
  const ENV_KEY = 'NEXT_PUBLIC_BASE_PATH';
  const originalValue = process.env[ENV_KEY];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  it('gibt den Pfad unveraendert zurueck, wenn kein Base-Path gesetzt ist (leerer Base-Path)', () => {
    delete process.env[ENV_KEY];
    expect(withBasePath('/api/x')).toBe('/api/x');
  });

  it('gibt den Pfad unveraendert zurueck, wenn NEXT_PUBLIC_BASE_PATH ein Leerstring ist', () => {
    process.env[ENV_KEY] = '';
    expect(withBasePath('/api/x')).toBe('/api/x');
  });

  it('prefixt einen Pfad mit dem konfigurierten Base-Path', () => {
    process.env[ENV_KEY] = '/erfassung';
    expect(withBasePath('/api/x')).toBe('/erfassung/api/x');
  });

  it('verdoppelt einen bereits prefixten Pfad nicht (Idempotenz)', () => {
    process.env[ENV_KEY] = '/erfassung';
    expect(withBasePath('/erfassung/api/x')).toBe('/erfassung/api/x');
  });

  it('behandelt den Root-Pfad "/" korrekt (kein doppelter Slash)', () => {
    process.env[ENV_KEY] = '/erfassung';
    expect(withBasePath('/')).toBe('/erfassung');
  });

  it('fuegt einen fehlenden fuehrenden Slash hinzu', () => {
    process.env[ENV_KEY] = '/erfassung';
    expect(withBasePath('api/x')).toBe('/erfassung/api/x');
  });

  it('ist idempotent bei doppeltem Aufruf', () => {
    process.env[ENV_KEY] = '/erfassung';
    const once = withBasePath('/api/x');
    expect(withBasePath(once)).toBe(once);
  });
});
