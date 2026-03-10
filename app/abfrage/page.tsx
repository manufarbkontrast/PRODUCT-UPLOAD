'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EanScanner from '@/components/EanScanner';
import type { EanLookupResult } from '@/config/ean-lookup-mappings';

interface InventoryLevel {
  readonly locationName: string;
  readonly available: number;
}

interface VariantInventory {
  readonly variantId: string;
  readonly title: string;
  readonly barcode: string | null;
  readonly sku: string | null;
  readonly price: string | null;
  readonly color: string | null;
  readonly size: string | null;
  readonly inventoryQuantity: number;
  readonly inventoryLevels: readonly InventoryLevel[];
}

interface InventoryData {
  readonly found: boolean;
  readonly productTitle?: string;
  readonly vendor?: string;
  readonly totalInventory?: number;
  readonly variants?: readonly VariantInventory[];
}

interface ProductInfo {
  readonly ean: string;
  readonly lookup: EanLookupResult;
}

export default function AbfragePage() {
  const router = useRouter();
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [scannedEan, setScannedEan] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const handleEanScan = (ean: string) => {
    setScannedEan(ean);
    setProductInfo(null);
    setInventoryData(null);
    setSearching(true);
    setLoadingInventory(false);
  };

  const handleLookupResult = useCallback((result: EanLookupResult) => {
    setSearching(false);
    if (scannedEan) {
      setProductInfo({ ean: scannedEan, lookup: result });
    }
  }, [scannedEan]);

  // Bestandsdaten laden wenn Produkt gefunden
  useEffect(() => {
    if (!productInfo?.lookup.found || !scannedEan) return;

    const fetchInventory = async () => {
      setLoadingInventory(true);
      try {
        const res = await fetch('/api/inventory-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ean: scannedEan }),
        });

        if (res.ok) {
          const data = await res.json();
          setInventoryData(data);
        }
      } catch (err) {
        console.warn('[Abfrage] Inventory lookup failed:', err);
      } finally {
        setLoadingInventory(false);
      }
    };

    fetchInventory();
  }, [productInfo, scannedEan]);

  const handleReset = () => {
    setProductInfo(null);
    setInventoryData(null);
    setScannedEan(null);
    setSearching(false);
    setLoadingInventory(false);
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
            <>
              {/* Artikelinfos */}
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
                  {productInfo.lookup.colorCode && (
                    <InfoRow label="Farb-Code" value={productInfo.lookup.colorCode} />
                  )}
                  {productInfo.lookup.size && (
                    <InfoRow label="Groesse" value={productInfo.lookup.size} />
                  )}
                  {productInfo.lookup.sku && (
                    <InfoRow label="SKU" value={productInfo.lookup.sku} />
                  )}
                  {productInfo.lookup.price && (
                    <InfoRow label="Preis" value={`${productInfo.lookup.price} EUR`} />
                  )}
                  {productInfo.lookup.inventoryQuantity !== undefined && (
                    <InfoRow
                      label="Bestand (diese Variante)"
                      value={String(productInfo.lookup.inventoryQuantity)}
                      highlight={productInfo.lookup.inventoryQuantity <= 0}
                    />
                  )}
                </div>
              </div>

              {/* Bestandsuebersicht */}
              {loadingInventory && (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-zinc-400 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-zinc-500">Lagerbestaende werden geladen...</p>
                  </div>
                </div>
              )}

              {inventoryData?.found && inventoryData.variants && (
                <>
                  {/* Gesamt-Bestand */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium">Gesamtbestand</p>
                        <span className={`text-lg font-bold ${
                          (inventoryData.totalInventory ?? 0) > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {inventoryData.totalInventory ?? 0}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {inventoryData.variants.length} Variante{inventoryData.variants.length !== 1 ? 'n' : ''} insgesamt
                      </p>
                    </div>

                    {/* Lager-Aufschluesselung */}
                    <LocationSummary variants={inventoryData.variants} />
                  </div>

                  {/* Alle Varianten */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <p className="text-sm font-medium">Alle Varianten</p>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {inventoryData.variants.map((variant) => {
                        const isScanned = variant.barcode === scannedEan;
                        return (
                          <div
                            key={variant.variantId}
                            className={`p-3 ${isScanned ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">
                                    {variant.color && variant.size
                                      ? `${variant.color} / ${variant.size}`
                                      : variant.title}
                                  </p>
                                  {isScanned && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
                                      Gescannt
                                    </span>
                                  )}
                                </div>
                                {variant.sku && (
                                  <p className="text-xs text-zinc-400 mt-0.5">SKU: {variant.sku}</p>
                                )}
                                {variant.barcode && (
                                  <p className="text-xs text-zinc-400">EAN: {variant.barcode}</p>
                                )}
                              </div>
                              <div className="text-right ml-3 flex-shrink-0">
                                <span className={`text-sm font-bold ${
                                  variant.inventoryQuantity > 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-500 dark:text-red-400'
                                }`}>
                                  {variant.inventoryQuantity}
                                </span>
                                <p className="text-[10px] text-zinc-400">verfuegbar</p>
                              </div>
                            </div>

                            {/* Lager pro Variante */}
                            {variant.inventoryLevels.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {variant.inventoryLevels.map((level) => (
                                  <div
                                    key={level.locationName}
                                    className="flex justify-between items-center text-xs text-zinc-500 pl-2 border-l-2 border-zinc-200 dark:border-zinc-700"
                                  >
                                    <span>{level.locationName}</span>
                                    <span className={level.available > 0 ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400'}>
                                      {level.available}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
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

/** Zusammenfassung nach Lager-Standort */
function LocationSummary({ variants }: { readonly variants: readonly VariantInventory[] }) {
  const locationTotals = new Map<string, number>();

  for (const variant of variants) {
    for (const level of variant.inventoryLevels) {
      const current = locationTotals.get(level.locationName) ?? 0;
      locationTotals.set(level.locationName, current + level.available);
    }
  }

  if (locationTotals.size === 0) return null;

  return (
    <div className="p-4 space-y-2">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Lager</p>
      {Array.from(locationTotals.entries()).map(([name, total]) => (
        <div key={name} className="flex justify-between items-center">
          <span className="text-sm">{name}</span>
          <span className={`text-sm font-semibold ${
            total > 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-500 dark:text-red-400'
          }`}>
            {total}
          </span>
        </div>
      ))}
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-zinc-500 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${
        highlight ? 'text-red-600 dark:text-red-400' : ''
      }`}>
        {value}
      </span>
    </div>
  );
}
