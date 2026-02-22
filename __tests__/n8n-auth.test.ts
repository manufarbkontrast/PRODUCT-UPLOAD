import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateN8nToken } from '@/lib/auth/n8n-auth';
import { NextRequest } from 'next/server';

describe('validateN8nToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    delete process.env.N8N_SHARED_SECRET;
    delete process.env.ADMIN_TOKEN;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('returns null when valid token matches N8N_SHARED_SECRET', () => {
    process.env.N8N_SHARED_SECRET = 'test-secret-123';

    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        'X-Admin-Token': 'test-secret-123',
      },
    });

    const result = validateN8nToken(request);
    expect(result).toBeNull();
  });

  it('returns null when valid token matches ADMIN_TOKEN fallback', () => {
    process.env.ADMIN_TOKEN = 'admin-token-456';

    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        'X-Admin-Token': 'admin-token-456',
      },
    });

    const result = validateN8nToken(request);
    expect(result).toBeNull();
  });

  it('prefers N8N_SHARED_SECRET over ADMIN_TOKEN', () => {
    process.env.N8N_SHARED_SECRET = 'n8n-secret';
    process.env.ADMIN_TOKEN = 'admin-token';

    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        'X-Admin-Token': 'n8n-secret',
      },
    });

    const result = validateN8nToken(request);
    expect(result).toBeNull();
  });

  it('returns 401 when no token provided', async () => {
    process.env.N8N_SHARED_SECRET = 'test-secret-123';

    const request = new NextRequest('http://localhost:3000/api/test');

    const result = validateN8nToken(request);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);

    const json = await result?.json();
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when invalid token provided', async () => {
    process.env.N8N_SHARED_SECRET = 'test-secret-123';

    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        'X-Admin-Token': 'wrong-token',
      },
    });

    const result = validateN8nToken(request);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);

    const json = await result?.json();
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when token has different length', async () => {
    process.env.N8N_SHARED_SECRET = 'short';

    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        'X-Admin-Token': 'this-is-a-much-longer-token',
      },
    });

    const result = validateN8nToken(request);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);

    const json = await result?.json();
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  it('returns 500 when neither secret is configured', async () => {
    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        'X-Admin-Token': 'some-token',
      },
    });

    const result = validateN8nToken(request);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(500);

    const json = await result?.json();
    expect(json).toEqual({ error: 'Server misconfigured' });
  });

  it('returns 401 when token is empty string', async () => {
    process.env.N8N_SHARED_SECRET = 'test-secret-123';

    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        'X-Admin-Token': '',
      },
    });

    const result = validateN8nToken(request);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('uses timing-safe comparison to prevent timing attacks', async () => {
    process.env.N8N_SHARED_SECRET = 'secret123';

    // Similar tokens that differ at the end
    const request1 = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        'X-Admin-Token': 'secret124',
      },
    });

    const result1 = validateN8nToken(request1);
    expect(result1).not.toBeNull();
    expect(result1?.status).toBe(401);
  });
});
