'use client';

import { useEffect, useState } from 'react';
import { BRAND_OPTIONS } from '@/config/brands';

interface ReorderButtonProps {
  readonly sku: string;
  readonly ean: string;
  readonly articleName: string;
  readonly size: string;
  /** Optional hint; user can change it in the dialog. */
  readonly brandHint?: string;
}

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'locked'; readonly filiale: string; readonly timestamp: string }
  | { readonly kind: 'open' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'success'; readonly filiale: string }
  | { readonly kind: 'error'; readonly message: string };

export default function ReorderButton({
  sku,
  ean,
  articleName,
  size,
  brandHint,
}: ReorderButtonProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [brand, setBrand] = useState<string>(brandHint ?? '');
  const [quantity, setQuantity] = useState<string>('1');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: 'checking' });
    fetch(`/api/reorder?sku=${encodeURIComponent(sku)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.locked) {
          setStatus({
            kind: 'locked',
            filiale: data.filiale ?? '?',
            timestamp: data.timestamp ?? '',
          });
        } else {
          setStatus({ kind: 'open' });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Statusprüfung fehlgeschlagen',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [sku]);

  const submit = async () => {
    if (!brand) return;
    setStatus({ kind: 'submitting' });
    try {
      const res = await fetch('/api/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ean, sku, articleName, brand, size, quantity, note }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setStatus({
          kind: 'locked',
          filiale: data.filiale ?? '?',
          timestamp: data.timestamp ?? '',
        });
        return;
      }
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: data?.error ?? `Fehler ${res.status}`,
        });
        return;
      }
      setStatus({ kind: 'success', filiale: data.filiale ?? '' });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Netzwerkfehler',
      });
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Nachbestellung</p>
        <span className="text-xs text-zinc-500">SKU {sku}</span>
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

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-zinc-500">Menge</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Größe</span>
          <input
            type="text"
            value={size}
            readOnly
            className="mt-1 w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-500"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-zinc-500">Notiz (optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900"
        />
      </label>

      <StatusLine status={status} />

      <button
        onClick={submit}
        disabled={
          !brand ||
          status.kind === 'checking' ||
          status.kind === 'submitting' ||
          status.kind === 'locked' ||
          status.kind === 'success'
        }
        className="w-full py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {status.kind === 'submitting' ? 'Wird gebucht…' : 'Nachbestellen'}
      </button>
    </div>
  );
}

function StatusLine({ status }: { readonly status: Status }) {
  if (status.kind === 'idle' || status.kind === 'open') return null;
  if (status.kind === 'checking') {
    return <p className="text-xs text-zinc-500">Status wird geprüft…</p>;
  }
  if (status.kind === 'locked') {
    const ts = status.timestamp
      ? new Date(status.timestamp).toLocaleString('de-DE')
      : '';
    return (
      <p className="text-xs text-red-600 dark:text-red-400">
        Bereits von Filiale <strong>{status.filiale}</strong> nachbestellt{ts ? ` am ${ts}` : ''}.
      </p>
    );
  }
  if (status.kind === 'success') {
    return (
      <p className="text-xs text-green-700 dark:text-green-400">
        Nachbestellung als <strong>{status.filiale}</strong> eingebucht.
      </p>
    );
  }
  if (status.kind === 'error') {
    return <p className="text-xs text-red-600 dark:text-red-400">{status.message}</p>;
  }
  return null;
}
