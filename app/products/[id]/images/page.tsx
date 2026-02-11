'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import ImageUploader from '@/components/ImageUploader';

interface ProductImage {
  id: string;
  originalPath: string;
  processedPath: string | null;
  filename: string;
  sortOrder: number;
  status: 'pending' | 'processing' | 'done' | 'error';
}

interface Product {
  id: string;
  name: string;
  category: string;
  status: string;
  driveUrl?: string | null;
  images?: ProductImage[];
}

/** Compute the current processing phase label */
function getPhaseLabel(status: string): string {
  switch (status) {
    case 'processing':
      return 'Bilder werden verarbeitet...';
    case 'processed':
      return 'Wird zu Google Drive hochgeladen...';
    case 'uploading':
      return 'Wird zu Google Drive hochgeladen...';
    case 'uploaded':
      return 'Fertig!';
    case 'drive_error':
      return 'Drive-Upload fehlgeschlagen';
    case 'error':
      return 'Verarbeitung fehlgeschlagen';
    default:
      return '';
  }
}

export default function ProductImagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error('Produkt nicht gefunden');
      const data = await res.json();
      setProduct(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // Poll while processing or uploading
  useEffect(() => {
    if (!product) return;

    const hasProcessing = product.images?.some(
      (img) => img.status === 'processing'
    );

    const needsPolling =
      hasProcessing ||
      product.status === 'processing' ||
      product.status === 'processed' ||
      product.status === 'uploading';

    if (needsPolling) {
      const interval = setInterval(fetchProduct, 3000);
      return () => clearInterval(interval);
    }
  }, [product, fetchProduct]);

  // Auto-trigger Drive upload when processing finished but upload was deferred (timeout protection)
  useEffect(() => {
    if (!product || product.status !== 'processed') return;

    const triggerUpload = async () => {
      try {
        console.log('[Images] Processing done, triggering separate Drive upload...');
        const res = await fetch(`/api/products/${id}/upload`, { method: 'POST' });
        if (!res.ok) {
          const data = await res.json();
          console.error('[Images] Drive upload failed:', data.error);
        }
        await fetchProduct();
      } catch (err) {
        console.error('[Images] Drive upload trigger failed:', err);
      }
    };

    triggerUpload();
  }, [product?.status, id, fetchProduct]);

  const handleProcessImages = async () => {
    if (!product) return;

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`/api/products/${id}/process`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Starten der Verarbeitung');
      }

      await fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verarbeitung fehlgeschlagen');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Bild wirklich löschen?')) return;

    try {
      const res = await fetch(`/api/products/${id}/images/${imageId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Löschen fehlgeschlagen');
      await fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  const getStatusBadge = (status: string) => {
    const styleMap: Record<string, string> = {
      pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
      processing: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      done: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      error: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    };

    const labelMap: Record<string, string> = {
      pending: 'Ausstehend',
      processing: 'Verarbeitung...',
      done: 'Fertig',
      error: 'Fehler',
    };

    const style = styleMap[status] || styleMap.pending;
    const label = labelMap[status] || status;

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${style}`}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 rounded-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">Produkt nicht gefunden</p>
        <Button onClick={() => router.push('/products')} className="mt-4">
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  const images = product.images || [];
  const pendingImages = images.filter((img) => img.status === 'pending');
  const processingImages = images.filter((img) => img.status === 'processing');
  const doneImages = images.filter((img) => img.status === 'done');
  const isProcessing = processingImages.length > 0 || product.status === 'processing';
  const isUploading = product.status === 'uploading';
  const isUploaded = product.status === 'uploaded';
  const isDriveError = product.status === 'drive_error';
  const isBusy = isProcessing || isUploading;

  // Progress calculation
  const totalImages = images.length;
  const processedCount = doneImages.length;
  const progressPercent = totalImages > 0
    ? Math.round((processedCount / totalImages) * 100)
    : 0;

  // Show "next product" when processing has started (even if still in progress)
  const showNextProduct = isBusy || isUploaded || isDriveError ||
    product.status === 'ready' || product.status === 'error';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-1"
          >
            ← Zurück
          </button>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Bilder: {product.name}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Kategorie: {product.category}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Progress bar during processing/uploading */}
      {(isBusy || isUploaded || isDriveError) && totalImages > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-900 dark:text-white">
              {getPhaseLabel(product.status)}
            </span>
            <span className="text-zinc-500">
              {isUploading
                ? 'Drive-Upload...'
                : isUploaded
                  ? `${processedCount} von ${totalImages} Bildern`
                  : `${processedCount} von ${totalImages} Bildern verarbeitet`}
            </span>
          </div>

          <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isUploaded
                  ? 'bg-green-500'
                  : isDriveError
                    ? 'bg-red-500'
                    : isUploading
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-blue-500'
              }`}
              style={{
                width: isUploading || isUploaded
                  ? '100%'
                  : `${progressPercent}%`,
              }}
            />
          </div>

          {isUploading && (
            <p className="text-xs text-zinc-500">
              Bilder werden zu Google Drive hochgeladen und in Google Sheets eingetragen...
            </p>
          )}
        </div>
      )}

      {/* Success: uploaded to Drive */}
      {isUploaded && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium text-green-700 dark:text-green-400">
              Produkt erfolgreich hochgeladen!
            </span>
          </div>
          {product.driveUrl && (
            <a
              href={product.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-700 dark:text-green-400 hover:underline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              In Google Drive öffnen
            </a>
          )}
        </div>
      )}

      {/* Drive error */}
      {isDriveError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="font-medium text-red-700 dark:text-red-400">
              Drive-Upload fehlgeschlagen
            </span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            Die Bilder wurden verarbeitet, aber der Upload zu Google Drive ist fehlgeschlagen.
            Sie können den Upload über die Produktseite erneut versuchen.
          </p>
        </div>
      )}

      {/* Next product button */}
      {showNextProduct && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
          <Link
            href="/products/new"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Nächstes Produkt hinzufügen
          </Link>
          {isBusy && (
            <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
              Die Bilder werden im Hintergrund weiterverarbeitet.
            </p>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">
          Bilder hochladen
        </h2>
        <ImageUploader productId={id} existingImageCount={images.length} onUploadComplete={fetchProduct} />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
              {images.length}
            </p>
            <p className="text-xs text-zinc-500">Gesamt</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-zinc-500">
              {pendingImages.length}
            </p>
            <p className="text-xs text-zinc-500">Ausstehend</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-blue-600">
              {processingImages.length}
            </p>
            <p className="text-xs text-blue-600">In Arbeit</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-green-600">
              {doneImages.length}
            </p>
            <p className="text-xs text-green-600">Fertig</p>
          </div>
        </div>
      )}

      {pendingImages.length > 0 && (
        <Button
          onClick={handleProcessImages}
          disabled={processing || isBusy}
          className="w-full"
        >
          {isBusy ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Verarbeitung läuft...
            </span>
          ) : (
            `${pendingImages.length} Bild${pendingImages.length !== 1 ? 'er' : ''} bearbeiten`
          )}
        </Button>
      )}

      {images.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">
            Alle Bilder
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative group rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 aspect-square"
              >
                <img
                  src={image.processedPath || image.originalPath}
                  alt={image.filename}
                  className="w-full h-full object-contain"
                />

                <div className="absolute top-2 left-2">
                  {getStatusBadge(image.status)}
                </div>

                {image.status === 'processing' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <svg className="animate-spin w-8 h-8 mx-auto mb-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="text-sm">Verarbeitung...</p>
                    </div>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <a
                    href={image.originalPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white rounded-full hover:bg-zinc-100"
                    title="Original ansehen"
                  >
                    <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </a>

                  {image.processedPath && (
                    <a
                      href={image.processedPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-green-500 rounded-full hover:bg-green-600"
                      title="Bearbeitet ansehen"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </a>
                  )}

                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    className="p-2 bg-red-500 rounded-full hover:bg-red-600"
                    title="Löschen"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p className="text-xs text-white truncate">{image.filename}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>Noch keine Bilder hochgeladen</p>
        </div>
      )}
    </div>
  );
}
