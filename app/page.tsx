'use client';

import Link from 'next/link';
import { useViewMode } from '@/contexts/ViewModeContext';

export default function Home() {
  const { isMobile } = useViewMode();

  if (!isMobile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>

        <div className="grid grid-cols-3 gap-6">
          <Link
            href="/products/new"
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-zinc-300 rounded-xl hover:border-zinc-900 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:hover:border-white dark:hover:bg-zinc-900"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-900 text-white flex items-center justify-center dark:bg-white dark:text-zinc-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium">Neues Produkt erstellen</span>
          </Link>

          <Link
            href="/products"
            className="flex flex-col justify-between p-6 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center mb-3 dark:bg-zinc-800">
                <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-sm font-medium">Alle Produkte</p>
              <p className="text-xs text-zinc-500 mt-1">Übersicht und Verwaltung</p>
            </div>
            <div className="flex items-center gap-1 mt-4 text-xs text-zinc-400">
              <span>Öffnen</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <div className="p-6 bg-zinc-50 rounded-xl dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-500 mb-3">So funktioniert&apos;s:</p>
            <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs flex items-center justify-center flex-shrink-0">1</span>
                Produktdaten eingeben
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs flex items-center justify-center flex-shrink-0">2</span>
                Bilder hochladen
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs flex items-center justify-center flex-shrink-0">3</span>
                Automatische Bearbeitung
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs flex items-center justify-center flex-shrink-0">4</span>
                Upload zu Google Drive
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile Dashboard ──
  return (
    <div className="space-y-5">
      {/* Grosser CTA Button */}
      <Link
        href="/products/new"
        className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-zinc-900 text-white rounded-2xl text-base font-medium active:scale-[0.98] transition-transform dark:bg-white dark:text-zinc-900"
      >
        <div className="w-8 h-8 rounded-full bg-white/20 dark:bg-zinc-900/20 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        Neues Produkt
      </Link>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/products"
          className="flex flex-col items-center gap-2 p-4 border border-zinc-200 rounded-xl active:bg-zinc-50 transition-colors dark:border-zinc-800 dark:active:bg-zinc-900"
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-xs font-medium">Produkte</span>
        </Link>

        <Link
          href="/products/new"
          className="flex flex-col items-center gap-2 p-4 border border-zinc-200 rounded-xl active:bg-zinc-50 transition-colors dark:border-zinc-800 dark:active:bg-zinc-900"
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <span className="text-xs font-medium">EAN Scannen</span>
        </Link>
      </div>

      {/* Anleitung */}
      <div className="p-4 bg-zinc-50 rounded-xl dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-500 mb-3">So funktioniert&apos;s:</p>
        <div className="space-y-2.5">
          {[
            { n: '1', text: 'EAN scannen oder eingeben' },
            { n: '2', text: 'Produktdaten prüfen' },
            { n: '3', text: 'Fotos aufnehmen' },
            { n: '4', text: 'Automatische Bearbeitung & Upload' },
          ].map((step) => (
            <div key={step.n} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs flex items-center justify-center flex-shrink-0 font-medium">
                {step.n}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{step.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
