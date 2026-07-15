import { categoryImageType } from '@/config/image-processing';

export interface ShoeView {
  readonly sortOrder: number;
  readonly key: string;
  readonly label: string;
  readonly description: string;
  /** Anleitungstext für den Fotografen (vom Inhaber exakt vorgegeben). */
  readonly anweisung: string;
  /** Pfad zum Piktogramm-SVG: Schuh + Kamera-Position + Richtungspfeil. */
  readonly piktogramm: string;
  /** Pfad zum Silhouetten-SVG: transparente Ausricht-Schablone fürs Kamera-Overlay. */
  readonly silhouette: string;
}

/**
 * Die 4 kanonischen Schuh-Foto-Ansichten (vom Inhaber exakt vorgegebene Sequenz).
 * Reihenfolge und sortOrder dürfen nicht verändert werden.
 */
export const SHOE_VIEWS: readonly ShoeView[] = [
  {
    sortOrder: 0,
    key: 'seite_aussen',
    label: 'Seitenansicht',
    description: 'Einzelschuh, Seite, Spitze links',
    anweisung: 'Schuh auf den Tisch stellen, Kamera auf Schuhhöhe, Schuhspitze zeigt nach LINKS.',
    piktogramm: '/foto-guide/1-seite.svg',
    silhouette: '/foto-guide/1-seite-silhouette.svg',
  },
  {
    sortOrder: 1,
    key: 'sohle',
    label: 'Sohle',
    description: 'Unterseite',
    anweisung: 'Schuh umlegen, sodass die Sohle zur Kamera zeigt.',
    piktogramm: '/foto-guide/2-sohle.svg',
    silhouette: '/foto-guide/2-sohle-silhouette.svg',
  },
  {
    sortOrder: 2,
    key: 'schraeg_vorne',
    label: 'Schräg von vorne',
    description: 'Einzelschuh, 3/4 von vorne',
    anweisung: 'Schuh wieder aufstellen und leicht zur Kamera drehen (3/4 von vorne).',
    piktogramm: '/foto-guide/3-schraeg-vorne.svg',
    silhouette: '/foto-guide/3-schraeg-vorne-silhouette.svg',
  },
  {
    sortOrder: 3,
    key: 'paar_profil',
    label: 'Paar im Profil',
    description: 'Beide Schuhe, leicht im Profil',
    anweisung: 'Zweiten Schuh dazustellen, beide leicht im Profil.',
    piktogramm: '/foto-guide/4-paar.svg',
    silhouette: '/foto-guide/4-paar-silhouette.svg',
  },
] as const;

const viewByKey = new Map(SHOE_VIEWS.map((v) => [v.key, v]));
const viewBySortOrder = new Map(SHOE_VIEWS.map((v) => [v.sortOrder, v]));

export function getShoeViewByKey(key: string): ShoeView | undefined {
  return viewByKey.get(key);
}

export function getShoeViewLabel(sortOrder: number): string | undefined {
  return viewBySortOrder.get(sortOrder)?.label;
}

export function getMissingViews(existingSortOrders: readonly number[]): readonly ShoeView[] {
  const present = new Set(existingSortOrders);
  return SHOE_VIEWS.filter((v) => !present.has(v.sortOrder));
}

export function isShoeCategory(category: string): boolean {
  return categoryImageType[category] === 'shoes';
}
