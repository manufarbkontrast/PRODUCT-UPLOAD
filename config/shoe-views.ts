import { categoryImageType } from '@/config/image-processing';

export interface ShoeView {
  readonly sortOrder: number;
  readonly key: string;
  readonly label: string;
  readonly description: string;
}

export const SHOE_VIEWS: readonly ShoeView[] = [
  { sortOrder: 0, key: 'side_outer', label: 'Seitenansicht', description: 'Einzelschuh, Seite, Spitze links' },
  { sortOrder: 1, key: 'back_pair_angled', label: 'Paar schräg', description: 'Zwei Schuhe von hinten, leicht schräg' },
  { sortOrder: 2, key: 'heel_pair', label: 'Fersenansicht', description: 'Paar gerade von hinten' },
  { sortOrder: 3, key: 'sole', label: 'Sohle', description: 'Unterseite' },
  { sortOrder: 4, key: 'angled_front', label: 'Schrägansicht', description: 'Einzelschuh, 3/4 von vorne' },
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
