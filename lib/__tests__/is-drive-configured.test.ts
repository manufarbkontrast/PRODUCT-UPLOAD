import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDriveConfigured } from '@/lib/google/auth';

const ENV_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
] as const;

describe('isDriveConfigured', () => {
  const originalValues = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]])
  );

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const original = originalValues[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it('ist false, wenn keine GOOGLE_* Env-Variablen gesetzt sind (kein lokales Service-Account-File)', () => {
    expect(isDriveConfigured()).toBe(false);
  });

  it('ist true, wenn OAuth2 (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) konfiguriert ist', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    expect(isDriveConfigured()).toBe(true);
  });

  it('ist false, wenn nur GOOGLE_CLIENT_ID ohne GOOGLE_CLIENT_SECRET gesetzt ist', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    expect(isDriveConfigured()).toBe(false);
  });

  it('ist true, wenn ein Service-Account per GOOGLE_SERVICE_ACCOUNT_JSON konfiguriert ist', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = Buffer.from(
      JSON.stringify({ client_email: 'test@example.com', private_key: 'x' })
    ).toString('base64');
    expect(isDriveConfigured()).toBe(true);
  });
});
