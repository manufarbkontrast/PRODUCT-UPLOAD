'use client';

import { useState, useEffect } from 'react';
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

interface JtlStockLocation {
  readonly storeNumber: string;
  readonly locationName: string;
  readonly available: number;
  readonly total: number;
}

interface JtlArticle {
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly gtin: string;
  readonly ownIdentifier: string;
  readonly manufacturerNumber: string;
  readonly availableStock: number;
  readonly totalStock: number;
  readonly salesPriceNet: number;
  readonly suggestedRetailPrice: number;
  readonly purchasePriceNet: number;
  readonly categories: string;
  readonly isActive: boolean;
  readonly parentItemId: string;
  readonly countryOfOrigin: string;
  readonly zalandoPrice: string;
  readonly stockLocations: readonly JtlStockLocation[];
}

interface JtlResult {
  readonly found: boolean;
  readonly source: 'jtl';
  readonly matchField?: string;
  readonly article?: JtlArticle;
  readonly variants?: readonly JtlArticle[];
  readonly totalStock?: number;
}

interface ProductInfo {
  readonly ean: string;
  readonly lookup: EanLookupResult;
}

export default function AbfragePage() {
  const router = useRouter();
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [jtlResult, setJtlResult] = useState<JtlResult | null>(null);
  const [scannedEan, setScannedEan] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [showScanner, setShowScanner] = useState(true);

  const handleEanScan = (ean: string) => {
    setScannedEan(ean);
    setProductInfo(null);
    setInventoryData(null);
    setJtlResult(null);
    setShowScanner(false);
    setSearching(true);
    setLoadingInventory(false);
  };

  // Lookup + Inventory parallel laden wenn EAN gescannt
  useEffect(() => {
    if (!scannedEan || !searching) return;

    const fetchData = async () => {
      try {
        // Shopify + JTL parallel abfragen
        const [lookupRes, inventoryRes, jtlRes] = await Promise.all([
          fetch('/api/ean-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ean: scannedEan }),
          }),
          fetch('/api/inventory-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ean: scannedEan }),
          }),
          fetch('/api/jtl-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ean: scannedEan }),
          }),
        ]);

        const lookupData: EanLookupResult = await lookupRes.json();
        setProductInfo({ ean: scannedEan, lookup: lookupData });

        if (inventoryRes.ok) {
          const invData = await inventoryRes.json();
          setInventoryData(invData);
        }

        if (jtlRes.ok) {
          const jtlData: JtlResult = await jtlRes.json();
          setJtlResult(jtlData);
        }
      } catch (err) {
        console.warn('[Abfrage] Lookup failed:', err);
        setProductInfo({ ean: scannedEan, lookup: { found: false } });
      } finally {
        setSearching(false);
        setLoadingInventory(false);
      }
    };

    fetchData();
  }, [scannedEan, searching]);

  const handleReset = () => {
    setProductInfo(null);
    setInventoryData(null);
    setJtlResult(null);
    setScannedEan(null);
    setSearching(false);
    setLoadingInventory(false);
    setShowScanner(true);
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

      {/* Scanner nur zeigen wenn noch kein Ergebnis */}
      {showScanner && (
        <EanScanner
          onScan={handleEanScan}
          autoLookup={false}
        />
      )}

      {/* Ladeanimation */}
      {searching && (
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-500 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Artikel wird gesucht...
          </p>
          <p className="text-xs text-zinc-500 mt-1">EAN: {scannedEan}</p>
        </div>
      )}

      {/* Ergebnisse */}
      {productInfo && !searching && (
        <div className="space-y-4">
          {/* JTL Ergebnis */}
          {jtlResult?.found && jtlResult.article && (
            <JtlResultCard
              article={jtlResult.article}
              matchField={jtlResult.matchField}
              variants={jtlResult.variants}
              totalStock={jtlResult.totalStock}
              scannedEan={scannedEan}
            />
          )}

          {/* Shopify Ergebnis */}
          {productInfo.lookup.found ? (
            <>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="bg-green-50 dark:bg-green-900/20 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      Shopify
                    </p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Gefunden
                    </span>
                  </div>
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

              {inventoryData?.found && inventoryData.variants && (
                <>
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium">Shopify Gesamtbestand</p>
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
                    <LocationSummary variants={inventoryData.variants} />
                  </div>
                  <VariantList variants={inventoryData.variants} scannedEan={scannedEan} />
                </>
              )}
            </>
          ) : !jtlResult?.found ? (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Artikel nicht gefunden
                </p>
              </div>
              <div className="p-4">
                <InfoRow label="EAN" value={productInfo.ean} />
                <p className="text-sm text-zinc-500 mt-3">
                  Weder in JTL noch in Shopify gefunden.
                </p>
              </div>
            </div>
          ) : null}

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

/** Klickbare Varianten-Liste mit Lager-Detail */
function VariantList({
  variants,
  scannedEan,
}: {
  readonly variants: readonly VariantInventory[];
  readonly scannedEan: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (variantId: string) => {
    setExpandedId((prev) => (prev === variantId ? null : variantId));
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <p className="text-sm font-medium">Alle Varianten</p>
        <p className="text-xs text-zinc-400 mt-0.5">Antippen fuer Details</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {variants.map((variant) => {
          const isScanned = variant.barcode === scannedEan;
          const isExpanded = expandedId === variant.variantId;
          const hasStock = variant.inventoryQuantity > 0;

          return (
            <button
              key={variant.variantId}
              onClick={() => toggle(variant.variantId)}
              className={`w-full text-left p-3 transition-colors ${
                isScanned
                  ? 'bg-blue-50/50 dark:bg-blue-900/10'
                  : isExpanded
                    ? 'bg-zinc-50/50 dark:bg-zinc-900/50'
                    : ''
              }`}
            >
              {/* Kopfzeile */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <svg
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform flex-shrink-0 ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
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
                <span className={`text-sm font-bold ml-3 flex-shrink-0 ${
                  hasStock
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-500 dark:text-red-400'
                }`}>
                  {variant.inventoryQuantity}
                </span>
              </div>

              {/* Aufgeklapptes Detail */}
              {isExpanded && (
                <div className="mt-3 ml-5.5 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  {variant.sku && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">SKU</span>
                      <span className="font-medium">{variant.sku}</span>
                    </div>
                  )}
                  {variant.barcode && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">EAN</span>
                      <span className="font-medium">{variant.barcode}</span>
                    </div>
                  )}
                  {variant.price && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Preis</span>
                      <span className="font-medium">{variant.price} EUR</span>
                    </div>
                  )}

                  {/* Lager-Standorte */}
                  {variant.inventoryLevels.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                        Lager / Filiale
                      </p>
                      <div className="space-y-1.5">
                        {variant.inventoryLevels.map((level) => (
                          <div
                            key={level.locationName}
                            className="flex justify-between items-center text-xs pl-2 border-l-2 border-zinc-200 dark:border-zinc-700"
                          >
                            <span className="text-zinc-600 dark:text-zinc-400">{level.locationName}</span>
                            <span className={`font-semibold ${
                              level.available > 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-500 dark:text-red-400'
                            }`}>
                              {level.available}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Bestand</span>
                      <span className={`font-semibold ${
                        hasStock
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}>
                        {variant.inventoryQuantity} verfuegbar
                      </span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
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

/**
 * Extrahiert die Groesse aus einer JTL-SKU.
 * "7061-2084841-256-44" → "44"
 * "18533-CD520-W32/L34" → "W32/L34"
 */
function extractSize(sku: string): string {
  // Suche nach Groessen-Pattern am Ende: -44, -W32/L34, -39, etc.
  const match = sku.match(/-([\w/]+)$/);
  return match ? match[1] : sku;
}

/** JTL Lager-Zusammenfassung ueber alle Varianten */
function JtlLocationSummary({ variants }: { readonly variants: readonly JtlArticle[] }) {
  const locationTotals = new Map<string, number>();

  for (const v of variants) {
    for (const loc of v.stockLocations) {
      const current = locationTotals.get(loc.locationName) ?? 0;
      locationTotals.set(loc.locationName, current + loc.available);
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

/** JTL Artikel-Ergebnis */
function JtlResultCard({
  article,
  matchField,
  variants,
  totalStock,
  scannedEan,
}: {
  readonly article: JtlArticle;
  readonly matchField?: string;
  readonly variants?: readonly JtlArticle[];
  readonly totalStock?: number;
  readonly scannedEan: string | null;
}) {
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const stock = totalStock ?? article.availableStock;
  const variantList = variants && variants.length > 1 ? variants : null;

  return (
    <div className="space-y-4">
      {/* Hauptinfo */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
              JTL Wawi
            </p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {matchField ?? 'Gefunden'}
            </span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <InfoRow label="Name" value={article.name} />
          <InfoRow label="SKU" value={article.sku} />
          {article.gtin && <InfoRow label="GTIN" value={article.gtin} />}
          {article.ownIdentifier && <InfoRow label="Eigene Nr." value={article.ownIdentifier} />}
          <InfoRow label="VK (UVP)" value={`${article.suggestedRetailPrice.toFixed(2)} EUR`} />
          <InfoRow label="EK (Netto)" value={`${article.purchasePriceNet.toFixed(2)} EUR`} />
          {article.zalandoPrice && <InfoRow label="Zalando" value={`${article.zalandoPrice} EUR`} />}
          {article.countryOfOrigin && <InfoRow label="Herkunft" value={article.countryOfOrigin} />}
        </div>
      </div>

      {/* Varianten mit Gesamtbestand und Lager-Zusammenfassung */}
      {variantList && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">JTL Bestand</p>
              <span className={`text-lg font-bold ${
                stock > 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {stock}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {variantList.length} Groesse{variantList.length !== 1 ? 'n' : ''}
            </p>
          </div>

          {/* Lager-Zusammenfassung */}
          <JtlLocationSummary variants={variantList} />

          {/* Groessen-Liste */}
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Groessen</p>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {variantList.map((v) => {
                const size = extractSize(v.sku);
                const isScanned = v.sku === article.sku;
                const isExpanded = expandedSku === v.sku;
                const hasStock = v.availableStock > 0;

                return (
                  <button
                    key={v.sku}
                    onClick={() => setExpandedSku(isExpanded ? null : v.sku)}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${
                      isScanned
                        ? 'bg-blue-50/50 dark:bg-blue-900/10'
                        : isExpanded
                          ? 'bg-zinc-50/50 dark:bg-zinc-900/50'
                          : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <svg
                          className={`w-3 h-3 text-zinc-400 transition-transform flex-shrink-0 ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium">{size}</span>
                        {isScanned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Gescannt
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${
                        hasStock
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}>
                        {v.availableStock}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 ml-5 space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">SKU</span>
                          <span className="font-medium">{v.sku}</span>
                        </div>
                        {v.gtin && (
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-500">GTIN</span>
                            <span className="font-medium">{v.gtin}</span>
                          </div>
                        )}
                        {v.stockLocations.map((loc) => (
                          <div
                            key={loc.storeNumber}
                            className="flex justify-between items-center text-xs pl-2 border-l-2 border-zinc-200 dark:border-zinc-700"
                          >
                            <span className="text-zinc-600 dark:text-zinc-400">{loc.locationName}</span>
                            <span className={`font-semibold ${
                              loc.available > 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-500 dark:text-red-400'
                            }`}>
                              {loc.available}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Einzelartikel ohne Varianten */}
      {!variantList && article.stockLocations.length > 1 && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Bestand</p>
              <span className={`text-lg font-bold ${
                article.availableStock > 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {article.availableStock}
              </span>
            </div>
          </div>
          <div className="p-4 space-y-1.5">
            {article.stockLocations.map((loc) => (
              <div
                key={loc.storeNumber}
                className="flex justify-between items-center text-xs pl-2 border-l-2 border-blue-200 dark:border-blue-800"
              >
                <span className="text-zinc-600 dark:text-zinc-400">{loc.locationName}</span>
                <span className={`font-semibold ${
                  loc.available > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-500 dark:text-red-400'
                }`}>
                  {loc.available}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
