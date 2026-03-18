'use client';

import { SHOE_VIEWS, type ShoeView } from '@/config/shoe-views';

interface ShoeViewBadgeProps {
  readonly sortOrder: number;
  readonly isShoe: boolean;
}

/** Badge showing the classified view type on a shoe image. */
export function ShoeViewBadge({ sortOrder, isShoe }: ShoeViewBadgeProps) {
  if (!isShoe) return null;

  const view = SHOE_VIEWS.find((v) => v.sortOrder === sortOrder);
  if (!view) return null;

  return (
    <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
      {view.label}
    </span>
  );
}

interface MissingViewsBarProps {
  readonly missingLabels: readonly string[];
}

/** Shows which standard shoe views are still missing. */
export function MissingViewsBar({ missingLabels }: MissingViewsBarProps) {
  if (missingLabels.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Alle 5 Standardansichten vorhanden
      </div>
    );
  }

  return (
    <div className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 space-y-1">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        {missingLabels.length} Ansicht{missingLabels.length !== 1 ? 'en' : ''} fehlt
      </div>
      <div className="flex flex-wrap gap-1.5 ml-6">
        {missingLabels.map((label) => (
          <span
            key={label}
            className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface ShoeViewOverviewProps {
  readonly images: ReadonlyArray<{ sortOrder: number }>;
}

/** Overview of all 5 standard views with present/missing status. */
export function ShoeViewOverview({ images }: ShoeViewOverviewProps) {
  const presentOrders = new Set(images.map((i) => i.sortOrder));

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {SHOE_VIEWS.map((view: ShoeView) => {
        const present = presentOrders.has(view.sortOrder);
        return (
          <div
            key={view.key}
            className={`text-center py-1.5 px-1 rounded text-xs ${
              present
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
            }`}
          >
            <div className="font-medium truncate">{view.label}</div>
            <div className="mt-0.5">{present ? '✓' : '—'}</div>
          </div>
        );
      })}
    </div>
  );
}
