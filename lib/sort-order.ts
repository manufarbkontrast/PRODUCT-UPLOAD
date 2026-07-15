import { SHOE_VIEWS } from '@/config/shoe-views';

/**
 * Validiert einen eingehenden `sortOrder`-Wert (z.B. aus FormData/JSON) gegen
 * die kanonische Schuh-Ansichten-Reihenfolge. Ohne Obergrenze konnte ein
 * beliebiger Wert (z.B. 999999) in `product_images.sort_order` landen und
 * `getMissingViews` dauerhaft kaputt machen (die kanonische Ansicht gilt dann
 * fuer immer als "fehlend") oder den Postgres-int4-Bereich sprengen -> 500.
 *
 * Reine Funktion: kein Zugriff auf DB/Request, nur Validierung. Gibt den
 * validierten Integer zurueck, wenn er ein Integer im Bereich
 * [0, SHOE_VIEWS.length) ist, sonst `null`.
 */
export function parseSortOrder(raw: unknown): number | null {
  if (typeof raw !== 'number') return null;
  if (!Number.isInteger(raw)) return null;
  if (raw < 0 || raw >= SHOE_VIEWS.length) return null;
  return raw;
}
