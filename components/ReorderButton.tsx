'use client';

import { useEffect, useMemo, useState } from 'react';
import { BRAND_OPTIONS } from '@/config/brands';

export interface ReorderVariant {
  readonly sku: string;
  readonly ean: string;
  readonly size: string;
}

interface ReorderButtonProps {
  readonly articleName: string;
  /** All sold-out variants that can be reordered. The scanned variant should be first. */
  readonly variants: readonly ReorderVariant[];
  /** SKUs that should be pre-selected (typically the scanned SKU). */
  readonly preselectedSkus?: readonly string[];
  readonly brandHint?: string;
}

interface Lock {
  readonly locked: boolean;
  readonly filiale?: string;
  readonly timestamp?: string;
}

type ItemResult =
  | { readonly sku: string; readonly ok: true; readonly timestamp: string }
  | { readonly sku: string; readonly ok: false; readonly locked: true; readonly filiale: string; readonly timestamp: string }
  | { readonly sku: string; readonly ok: false; readonly error: string };

type Phase = 'idle' | 'loading-locks' | 'submitting' | 'done';

export default function ReorderButton({
  articleName,
  variants,
  preselectedSkus,
  brandHint,
}: ReorderButtonProps) {
  const [phase, setPhase] = useState<Phase>('loading-locks');
  const [locks, setLocks] = useState<Record<string, Lock>>({});
  const [selectedSkus, setSelectedSkus] = useState<ReadonlySet<string>>(() => {
    return new Set(preselectedSkus ?? []);
  });
  const [brand, setBrand] = useState<string>(brandHint ?? '');
  const [note, setNote] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [results, setResults] = useState<readonly ItemResult[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const skuList = useMemo(() => variants.map((v) => v.sku).join(','), [variants]);

  useEffect(() => {
    if (variants.length === 0) {
      setPhase('idle');
      return;
    }
    let cancelled = false;
    setPhase('loading-locks');
    fetch(`/api/reorder?skus=${encodeURIComponent(skuList)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLocks(data?.locks ?? {});
        setPhase('idle');
      })
      .catch(() => {
        if (!cancelled) setPhase('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [skuList, variants.length]);

  const toggleSku = (sku: string) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  const setQty = (sku: string, q: string) => {
    setQuantities((prev) => ({ ...prev, [sku]: q }));
  };

  const submit = async () => {
    setSubmitError(null);
    if (!brand) {
      setSubmitError('Marke auswählen');
      return;
    }
    const chosen = variants.filter((v) => selectedSkus.has(v.sku));
    if (chosen.length === 0) {
      setSubmitError('Mindestens eine Größe auswählen');
      return;
    }
    setPhase('submitting');
    try {
      const res = await fetch('/api/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          note,
          items: chosen.map((v) => ({
            sku: v.sku,
            ean: v.ean,
            size: v.size,
            articleName,
            quantity: quantities[v.sku] || '1',
          })),
        }),
      });
      const data = await res.json();
      const newResults: readonly ItemResult[] = data?.results ?? [];
      setResults(newResults);

      // Merge successful + newly locked into local lock state
      setLocks((prev) => {
        const next = { ...prev };
        for (const r of newResults) {
          if (r.ok) {
            next[r.sku] = { locked: true, filiale: data.filiale, timestamp: r.timestamp };
          } else if ('locked' in r && r.locked) {
            next[r.sku] = { locked: true, filiale: r.filiale, timestamp: r.timestamp };
          }
        }
        return next;
      });
      setPhase('done');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Netzwerkfehler');
      setPhase('idle');
    }
  };

  if (variants.length === 0) return null;

  const availableToSelect = variants.filter((v) => !locks[v.sku]?.locked);
  const canSubmit =
    phase !== 'submitting' &&
    phase !== 'loading-locks' &&
    phase !== 'done' &&
    selectedSkus.size > 0 &&
    !!brand;

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Nachbestellung</p>
        {phase === 'loading-locks' && (
          <span className="text-xs text-zinc-500">Prüfe Status…</span>
        )}
      </div>

      <label className="block">
        <span className="text-xs text-zinc-500">Marke</span>
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900"
        >
          <option value="">— Marke wählen —</option>
          {BRAND_OPTIONS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1.5">
        <p className="text-xs text-zinc-500">Größen auswählen</p>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          {variants.map((v) => {
            const lock = locks[v.sku];
            const checked = selectedSkus.has(v.sku);
            const done = results.find((r) => r.sku === v.sku);
            const disabled = !!lock?.locked || phase === 'submitting' || phase === 'done';

            return (
              <li key={v.sku} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={checked && !disabled}
                  disabled={disabled}
                  onChange={() => toggleSku(v.sku)}
                  className="w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{v.size || '—'}</span>
                    <span className="text-xs text-zinc-500 truncate">{v.sku}</span>
                  </div>
                  {lock?.locked && !done && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Gesperrt von {lock.filiale}
                    </p>
                  )}
                  {done?.ok && (
                    <p className="text-xs text-green-700 dark:text-green-400">Gebucht</p>
                  )}
                  {done && !done.ok && 'locked' in done && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Zwischenzeitlich gesperrt von {done.filiale}
                    </p>
                  )}
                  {done && !done.ok && 'error' in done && (
                    <p className="text-xs text-red-600 dark:text-red-400">{done.error}</p>
                  )}
                </div>
                <input
                  type="number"
                  min={1}
                  value={quantities[v.sku] ?? '1'}
                  onChange={(e) => setQty(v.sku, e.target.value)}
                  disabled={disabled || !checked}
                  className="w-14 px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 disabled:opacity-40"
                />
              </li>
            );
          })}
        </ul>
      </div>

      <label className="block">
        <span className="text-xs text-zinc-500">Notiz (optional, für alle Zeilen)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={phase === 'submitting' || phase === 'done'}
          className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 disabled:opacity-40"
        />
      </label>

      {submitError && (
        <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>
      )}

      {phase !== 'done' ? (
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {phase === 'submitting'
            ? 'Wird gebucht…'
            : selectedSkus.size > 1
              ? `${selectedSkus.size} Größen nachbestellen`
              : 'Nachbestellen'}
        </button>
      ) : (
        <SummaryLine results={results} availableRemaining={availableToSelect.length} />
      )}
    </div>
  );
}

function SummaryLine({
  results,
  availableRemaining,
}: {
  readonly results: readonly ItemResult[];
  readonly availableRemaining: number;
}) {
  const ok = results.filter((r) => r.ok).length;
  const locked = results.filter((r) => !r.ok && 'locked' in r && r.locked).length;
  const errored = results.filter((r) => !r.ok && 'error' in r).length;

  return (
    <div className="text-sm space-y-1 py-2">
      {ok > 0 && (
        <p className="text-green-700 dark:text-green-400">
          ✓ {ok} Zeile{ok !== 1 ? 'n' : ''} gebucht
        </p>
      )}
      {locked > 0 && (
        <p className="text-red-600 dark:text-red-400">
          {locked} bereits von anderer Filiale gesperrt
        </p>
      )}
      {errored > 0 && (
        <p className="text-red-600 dark:text-red-400">
          {errored} Fehler — nochmal versuchen
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Noch {availableRemaining} Größe{availableRemaining !== 1 ? 'n' : ''} frei.
      </p>
    </div>
  );
}
