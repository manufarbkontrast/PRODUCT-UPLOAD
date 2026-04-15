import { describe, it, expect } from 'vitest';
import { isFilialeCode, FILIALE_CODES } from '@/lib/auth/require-filiale';

describe('isFilialeCode', () => {
  it('accepts all configured filiale codes', () => {
    for (const code of FILIALE_CODES) {
      expect(isFilialeCode(code)).toBe(true);
    }
  });

  it('rejects unknown codes', () => {
    expect(isFilialeCode('XYZ')).toBe(false);
    expect(isFilialeCode('')).toBe(false);
    expect(isFilialeCode('spz')).toBe(false); // lowercase not allowed
  });

  it('exposes exactly five codes', () => {
    expect(FILIALE_CODES).toEqual(['J&C', 'SPZ', 'SPR', 'SPSW', 'SPW']);
  });
});
