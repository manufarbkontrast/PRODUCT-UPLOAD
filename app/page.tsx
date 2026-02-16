'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import EanScanner from '@/components/EanScanner';
import type { EanLookupResult } from '@/config/ean-lookup-mappings';

interface RecentProduct {
  readonly id: string;
  readonly name: string;
  readonly ean: string | null;
  readonly status: string;
  readonly driveUrl: string | null;
  readonly createdAt: string;
  readonly images: readonly { readonly id: string }[];
}

const STATUS_CONFIG: Record<string, { readonly label: string; readonly color: string }> = {
  draft: { label: 'Entwurf', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  processing: { label: 'Verarbeitung...', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  processed: { label: 'Verarbeitet', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  uploading: { label: 'Upload...', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  uploaded: { label: 'Fertig', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  error: { label: 'Fehler', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  drive_error: { label: 'Drive-Fehler', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
};

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProducts, setRecentProducts] = useState<readonly RecentProduct[]>([]);
  const [lookupData, setLookupData] = useState<EanLookupResult | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [scannedEan, setScannedEan] = useState<string | null>(null);
  const hasActiveRef = useRef(false);

  const fetchRecentProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setRecentProducts(data.slice(0, 10));
      }
    } catch (err) {
      console.warn('[Home] Failed to fetch recent products:', err);
    }
  }, []);

  useEffect(() => {
    fetchRecentProducts();
  }, [fetchRecentProducts]);

  // Track active products for polling
  useEffect(() => {
    hasActiveRef.current = recentProducts.some(
      (p) => p.status === 'processing' || p.status === 'uploading' || p.status === 'processed'
    );
  }, [recentProducts]);

  // Poll for status changes on processing products
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasActiveRef.current) {
        fetchRecentProducts();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchRecentProducts]);

  const handleEanScan = (ean: string) => {
    setScannedEan(ean);
    setLookupDone(false);
    setLookupData(null);
    setError(null);
  };

  const handleLookupResult = useCallback((result: EanLookupResult) => {
    setLookupData(result);
    setLookupDone(true);
  }, []);

  // Create product and redirect to images when both EAN and lookup are done
  useEffect(() => {
    if (!scannedEan || !lookupDone || creating) return;

    const createProduct = async () => {
      setCreating(true);
      setError(null);

      try {
        const productData = {
          ean: scannedEan,
          name: lookupData?.found && lookupData.name ? lookupData.name : `Produkt ${scannedEan}`,
          gender: lookupData?.found && lookupData.genderCode ? lookupData.genderCode : 'UNISEX',
          category: 'standard',
          zalandoAttributes: buildZalandoAttributes(lookupData),
        };

        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        });

        if (!res.ok) {
          const errorBody = await res.text();
          console.error('[Home] POST /api/products failed:', res.status, errorBody);
          throw new Error(
            res.status === 401
              ? 'Nicht eingeloggt. Bitte neu einloggen.'
              : `Fehler beim Erstellen (${res.status})`
          );
        }

        const product = await res.json();
        router.push(`/products/${product.id}/images`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler beim Erstellen';
        setError(message);
        setScannedEan(null);
        setLookupData(null);
        setLookupDone(false);
      } finally {
        setCreating(false);
      }
    };

    createProduct();
  }, [scannedEan, lookupDone, lookupData, creating, router]);

  const getStatusInfo = (status: string) => {
    return STATUS_CONFIG[status] ?? { label: status, color: 'bg-zinc-100 text-zinc-600' };
  };

  // Loading state while creating product
  if (creating) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <svg className="w-7 h-7 text-zinc-500 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Produkt wird erstellt...
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Weiterleitung zur Bildaufnahme
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* EAN Scanner */}
      <div>
        <h1 className="text-xl font-semibold mb-4">Produkt scannen</h1>
        <EanScanner
          onScan={handleEanScan}
          onLookupResult={handleLookupResult}
          autoLookup={true}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Recent Products Status */}
      {recentProducts.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-zinc-500 mb-3">Letzte Produkte</h2>
          <div className="space-y-2">
            {recentProducts.map((product) => {
              const statusInfo = getStatusInfo(product.status);
              return (
                <button
                  key={product.id}
                  onClick={() => router.push(`/products/${product.id}/images`)}
                  className="flex items-center justify-between w-full p-3 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 text-left transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {product.ean ?? 'Ohne EAN'} · {product.images.length} Bild{product.images.length !== 1 ? 'er' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    {product.driveUrl && (
                      <a
                        href={product.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Drive
                      </a>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function buildZalandoAttributes(lookupData: EanLookupResult | null): Record<string, string> {
  if (!lookupData?.found) return {};

  const attrs: Record<string, string> = {};

  if (lookupData.brandCode) {
    attrs.brand_code = lookupData.brandCode;
  } else if (lookupData.brand) {
    attrs.brand_code = lookupData.brand;
  }
  if (lookupData.colorCode) {
    attrs.color_code_primary = lookupData.colorCode;
  }
  if (lookupData.material) {
    attrs.material_upper_material_clothing = lookupData.material;
  }
  if (lookupData.sku) {
    attrs.sku = lookupData.sku;
  }
  if (lookupData.size) {
    attrs.size_codes = lookupData.size;
  }

  return attrs;
}
