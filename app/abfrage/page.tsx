'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EanScanner from '@/components/EanScanner';
import type { EanLookupResult } from '@/config/ean-lookup-mappings';

interface ProductInfo {
  readonly ean: string;
  readonly lookup: EanLookupResult;
}

export default function AbfragePage() {
  const router = useRouter();
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [scannedEan, setScannedEan] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const handleEanScan = (ean: string) => {
    setScannedEan(ean);
    setProductInfo(null);
    setSearching(true);
  };

  const handleLookupResult = useCallback((result: EanLookupResult) => {
    setSearching(false);
    if (scannedEan) {
      setProductInfo({ ean: scannedEan, lookup: result });
    }
  }, [scannedEan]);

  const handleReset = () => {
    setProductInfo(null);
    setScannedEan(null);
    setSearching(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.push('/')}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Zurueck"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold">Artikel Abfrage</h1>
      </div>

      {!productInfo && (
        <EanScanner
          onScan={handleEanScan}
          onLookupResult={handleLookupResult}
          autoLookup={true}
        />
      )}

      {searching && (
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-500 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-500">Artikel wird gesucht...</p>
        </div>
      )}

      {productInfo && (
        <div className="space-y-4">
          {productInfo.lookup.found ? (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <div className="bg-green-50 dark:bg-green-900/20 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Artikel gefunden
                </p>
              </div>
              <div className="p-4 space-y-3">
                <InfoRow label="EAN" value={productInfo.ean} />
                {productInfo.lookup.name && (
                  <InfoRow label="Name" value={productInfo.lookup.name} />
                )}
                {productInfo.lookup.brand && (
                  <InfoRow label="Marke" value={productInfo.lookup.brand} />
                )}
                {productInfo.lookup.brandCode && (
                  <InfoRow label="Marken-Code" value={productInfo.lookup.brandCode} />
                )}
                {productInfo.lookup.colorCode && (
                  <InfoRow label="Farb-Code" value={productInfo.lookup.colorCode} />
                )}
                {productInfo.lookup.genderCode && (
                  <InfoRow label="Geschlecht" value={productInfo.lookup.genderCode} />
                )}
                {productInfo.lookup.material && (
                  <InfoRow label="Material" value={productInfo.lookup.material} />
                )}
                {productInfo.lookup.sku && (
                  <InfoRow label="SKU" value={productInfo.lookup.sku} />
                )}
                {productInfo.lookup.size && (
                  <InfoRow label="Groesse" value={productInfo.lookup.size} />
                )}
              </div>
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Artikel nicht gefunden
                </p>
              </div>
              <div className="p-4">
                <InfoRow label="EAN" value={productInfo.ean} />
                <p className="text-sm text-zinc-500 mt-3">
                  Dieser Artikel ist nicht in der Datenbank hinterlegt.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
          >
            Neuen Artikel scannen
          </button>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-zinc-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
