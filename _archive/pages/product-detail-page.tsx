'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { statusLabels, statusColors, genderOptions } from '@/config/product';
import { useViewMode } from '@/contexts/ViewModeContext';

interface Product {
  id: string;
  ean: string | null;
  name: string;
  gender: string;
  category: string;
  description: string | null;
  sku: string | null;
  status: string;
  driveUrl: string | null;
  createdAt: string;
  images: {
    id: string;
    filename: string;
    originalPath: string;
    processedPath: string | null;
    status: string;
  }[];
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isMobile } = useViewMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const success = searchParams.get('success') === 'true';

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) throw new Error('Produkt nicht gefunden');
        const data = await res.json();
        setProduct(data);
      } catch {
        router.push('/products');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, router]);

  const handleDelete = async () => {
    if (!confirm('Produkt wirklich löschen?')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/products');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

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

  if (!product) return null;

  const genderLabel = genderOptions.find(g => g.value === product.gender)?.label || product.gender;

  const detailsBlock = (
    <div className="space-y-2 p-3 bg-zinc-50 rounded-lg dark:bg-zinc-900">
      {product.ean && (
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">EAN</span>
          <span className="font-mono">{product.ean}</span>
        </div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Kategorie</span>
        <span>{product.category}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Geschlecht</span>
        <span>{genderLabel}</span>
      </div>
      {product.sku && (
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Artikelnr.</span>
          <span>{product.sku}</span>
        </div>
      )}
      {product.description && (
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 mb-1">Beschreibung</p>
          <p className="text-sm">{product.description}</p>
        </div>
      )}
    </div>
  );

  const actionsBlock = (
    <div className={`space-y-2 pt-2 ${!isMobile ? 'flex gap-3 pt-0 space-y-0 flex-wrap' : ''}`}>
      <Link href={`/products/${id}/edit`} className={isMobile ? 'block' : ''}>
        <Button className={isMobile ? 'w-full' : ''}>
          Bearbeiten
        </Button>
      </Link>

      <Link href={`/products/${id}/images`} className={isMobile ? 'block' : ''}>
        <Button variant="secondary" className={isMobile ? 'w-full' : ''}>
          Bilder bearbeiten
        </Button>
      </Link>

      <Link href="/products/new" className={isMobile ? 'block' : ''}>
        <Button variant="secondary" className={isMobile ? 'w-full' : ''}>
          Neues Produkt
        </Button>
      </Link>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className={`py-2 text-sm text-red-600 hover:text-red-700 ${isMobile ? 'w-full' : 'ml-auto'}`}
      >
        {deleting ? 'Wird gelöscht...' : 'Produkt löschen'}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/products')}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={`font-semibold truncate ${isMobile ? 'text-xl' : 'text-2xl'}`}>{product.name}</h1>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
          Produkt erfolgreich zu Google Drive hochgeladen!
        </div>
      )}

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded ${statusColors[product.status] || 'bg-zinc-100 text-zinc-600'}`}>
          {statusLabels[product.status] || product.status}
        </span>
        {product.driveUrl && (
          <a
            href={product.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 underline"
          >
            In Drive öffnen
          </a>
        )}
      </div>

      {isMobile ? (
        /* Mobile: stacked */
        <>
          {product.images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {product.images.map((img) => (
                <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <img src={img.processedPath || img.originalPath} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
          {detailsBlock}
          {actionsBlock}
        </>
      ) : (
        /* Desktop: side-by-side */
        <>
          <div className="grid grid-cols-2 gap-8">
            {/* Left: Images */}
            <div>
              {product.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {product.images.map((img) => (
                    <div key={img.id} className="aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      <img src={img.processedPath || img.originalPath} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <svg className="w-16 h-16 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Right: Details */}
            <div className="space-y-4">
              {detailsBlock}
              {actionsBlock}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
