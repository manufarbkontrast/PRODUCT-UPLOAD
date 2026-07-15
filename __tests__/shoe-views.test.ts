import { describe, it, expect } from 'vitest';
import {
  SHOE_VIEWS,
  getShoeViewByKey,
  getShoeViewLabel,
  getMissingViews,
  isShoeCategory,
} from '@/config/shoe-views';

describe('SHOE_VIEWS', () => {
  it('contains exactly the 4 canonical views in the owner-mandated order', () => {
    expect(SHOE_VIEWS).toHaveLength(4);
    expect(SHOE_VIEWS.map((v) => v.key)).toEqual([
      'seite_aussen',
      'sohle',
      'schraeg_vorne',
      'paar_profil',
    ]);
  });

  it('has sortOrder 0-3 in ascending order matching array position', () => {
    SHOE_VIEWS.forEach((v, i) => {
      expect(v.sortOrder).toBe(i);
    });
  });

  it('has the correct German labels', () => {
    expect(SHOE_VIEWS.map((v) => v.label)).toEqual([
      'Seitenansicht',
      'Sohle',
      'Schräg von vorne',
      'Paar im Profil',
    ]);
  });

  it('has the owner-mandated anweisung text for each view', () => {
    const byKey = new Map(SHOE_VIEWS.map((v) => [v.key, v.anweisung]));
    expect(byKey.get('seite_aussen')).toBe(
      'Schuh auf den Tisch stellen, Kamera auf Schuhhöhe, Schuhspitze zeigt nach LINKS.'
    );
    expect(byKey.get('sohle')).toBe('Schuh umlegen, sodass die Sohle zur Kamera zeigt.');
    expect(byKey.get('schraeg_vorne')).toBe(
      'Schuh wieder aufstellen und leicht zur Kamera drehen (3/4 von vorne).'
    );
    expect(byKey.get('paar_profil')).toBe('Zweiten Schuh dazustellen, beide leicht im Profil.');
  });

  it('has non-empty piktogramm and silhouette SVG paths under /foto-guide/', () => {
    for (const v of SHOE_VIEWS) {
      expect(v.piktogramm).toMatch(/^\/foto-guide\/.+\.svg$/);
      expect(v.silhouette).toMatch(/^\/foto-guide\/.+-silhouette\.svg$/);
    }
  });
});

describe('getShoeViewByKey', () => {
  it('returns the matching view for each canonical key', () => {
    expect(getShoeViewByKey('seite_aussen')?.label).toBe('Seitenansicht');
    expect(getShoeViewByKey('sohle')?.label).toBe('Sohle');
    expect(getShoeViewByKey('schraeg_vorne')?.label).toBe('Schräg von vorne');
    expect(getShoeViewByKey('paar_profil')?.label).toBe('Paar im Profil');
  });

  it('returns undefined for an unknown key', () => {
    expect(getShoeViewByKey('unknown')).toBeUndefined();
    expect(getShoeViewByKey('side_outer')).toBeUndefined();
  });
});

describe('getShoeViewLabel', () => {
  it('returns the label for each valid sortOrder', () => {
    expect(getShoeViewLabel(0)).toBe('Seitenansicht');
    expect(getShoeViewLabel(1)).toBe('Sohle');
    expect(getShoeViewLabel(2)).toBe('Schräg von vorne');
    expect(getShoeViewLabel(3)).toBe('Paar im Profil');
  });

  it('returns undefined for an out-of-range sortOrder', () => {
    expect(getShoeViewLabel(4)).toBeUndefined();
    expect(getShoeViewLabel(-1)).toBeUndefined();
  });
});

describe('getMissingViews', () => {
  it('returns all 4 views when nothing is present', () => {
    expect(getMissingViews([])).toHaveLength(4);
  });

  it('returns an empty array when all 4 sortOrders are present', () => {
    expect(getMissingViews([0, 1, 2, 3])).toEqual([]);
  });

  it('returns only the missing views for a partial set', () => {
    const missing = getMissingViews([0, 2]);
    expect(missing.map((v) => v.sortOrder)).toEqual([1, 3]);
  });

  it('ignores sortOrders outside the canonical range', () => {
    const missing = getMissingViews([0, 1, 2, 3, 5, 6]);
    expect(missing).toEqual([]);
  });
});

describe('isShoeCategory', () => {
  it('returns true for shoe categories', () => {
    expect(isShoeCategory('sneaker')).toBe(true);
    expect(isShoeCategory('boots')).toBe(true);
  });

  it('returns false for non-shoe categories', () => {
    expect(isShoeCategory('t_shirt_top')).toBe(false);
    expect(isShoeCategory('bag')).toBe(false);
  });
});
