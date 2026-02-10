'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { statusLabels, statusColors } from '@/config/product';
import { useViewMode } from '@/contexts/ViewModeContext';

interface Product {
  id: string;
  name: string;
  gender: string;
  category: string;
  status: string;
  createdAt: string;
  images: {
    id: string;
    originalPath: string;
    processedPath: string | null;
  }[];
}

export default function ProductsPage() {
  const { isMobile } = useViewMode();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="w-6 h-6 animate-spin text-zinc-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className={`font-semibold ${isMobile ? 'text-xl' : 'text-2xl'}`}>Produkte</h1>
        <Link
          href="/products/new"
          className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-sm font-medium dark:bg-white dark:text-zinc-900"
        >
          + Neu
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-sm text-zinc-500">Noch keine Produkte</p>
          <Link href="/products/new" className="text-sm text-zinc-900 underline dark:text-white mt-2 inline-block">
            Erstes Produkt erstellen
          </Link>
        </div>
      ) : isMobile ? (
        /* Mobile: Liste */
        <div className="space-y-2">
          {products.map((product) => {
            const firstImage = product.images[0];
            const imageUrl = firstImage?.processedPath || firstImage?.originalPath;

            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="flex gap-3 p-3 border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-zinc-500">{product.category} · {product.gender}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[product.status] || 'bg-zinc-100 text-zinc-600'}`}>
                      {statusLabels[product.status] || product.status}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {product.images.length} Bild{product.images.length !== 1 ? 'er' : ''}
                    </span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-zinc-400 flex-shrink-0 self-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Desktop: Grid Cards */
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const firstImage = product.images[0];
            const imageUrl = firstImage?.processedPath || firstImage?.originalPath;

            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="border border-zinc-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow dark:border-zinc-800"
              >
                <div className="aspect-square bg-zinc-100 dark:bg-zinc-800">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{product.category} · {product.gender}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[product.status] || 'bg-zinc-100 text-zinc-600'}`}>
                      {statusLabels[product.status] || product.status}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {product.images.length} Bild{product.images.length !== 1 ? 'er' : ''}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
