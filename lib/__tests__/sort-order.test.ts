import { describe, it, expect } from 'vitest';
import { parseSortOrder } from '@/lib/sort-order';
import { SHOE_VIEWS } from '@/config/shoe-views';

describe('parseSortOrder', () => {
  it('accepts every valid canonical index 0..SHOE_VIEWS.length-1', () => {
    for (let i = 0; i < SHOE_VIEWS.length; i += 1) {
      expect(parseSortOrder(i)).toBe(i);
    }
  });

  it('accepts the last valid index (SHOE_VIEWS.length - 1)', () => {
    expect(parseSortOrder(SHOE_VIEWS.length - 1)).toBe(SHOE_VIEWS.length - 1);
  });

  it('rejects the value equal to SHOE_VIEWS.length (one past the last valid index)', () => {
    expect(parseSortOrder(SHOE_VIEWS.length)).toBeNull();
  });

  it('rejects negative numbers', () => {
    expect(parseSortOrder(-1)).toBeNull();
  });

  it('rejects wildly out-of-range values (would overflow int4 / break getMissingViews)', () => {
    expect(parseSortOrder(999999)).toBeNull();
  });

  it('rejects non-integer numbers', () => {
    expect(parseSortOrder(1.5)).toBeNull();
  });

  it('rejects NaN', () => {
    expect(parseSortOrder(NaN)).toBeNull();
  });

  it('rejects numeric strings (caller must convert before calling)', () => {
    expect(parseSortOrder('2')).toBeNull();
  });

  it('rejects null', () => {
    expect(parseSortOrder(null)).toBeNull();
  });

  it('rejects undefined', () => {
    expect(parseSortOrder(undefined)).toBeNull();
  });

  it('rejects plain objects', () => {
    expect(parseSortOrder({})).toBeNull();
  });
});
