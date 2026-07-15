'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/shadcn/button';
import ImageUploader from '@/components/ImageUploader';
import GuidedPhotoCapture from '@/components/GuidedPhotoCapture';
import { ShoeViewBadge, MissingViewsBar, ShoeViewOverview } from '@/components/ShoeViewIndicator';
import { isShoeCategory } from '@/config/shoe-views';
import { IMAGE_POLL_INTERVAL_MS } from '@/config/constants';
import { withBasePath } from '@/lib/base-path';

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
  const [deleting, setDeleting] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [missingViewLabels, setMissingViewLabels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guidedCaptureOpen, setGuidedCaptureOpen] = useState(false);

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(withBasePath(`/api/products/${id}`));
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
      const interval = setInterval(fetchProduct, IMAGE_POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [product, fetchProduct]);

  // Auto-trigger Drive upload when processing finished (status='processed').
  // Uses a ref to prevent double-triggering from React re-renders.
  const uploadTriggeredRef = useRef(false);
  useEffect(() => {
    if (!product || product.status !== 'processed') {
      // Reset flag when status changes away from 'processed'
      uploadTriggeredRef.current = false;
      return;
    }

    if (uploadTriggeredRef.current) return;
    uploadTriggeredRef.current = true;

    const triggerUpload = async () => {
      try {
        console.log('[Images] Processing done, triggering separate Drive upload...');
        const res = await fetch(withBasePath(`/api/products/${id}/upload`), { method: 'POST' });
        if (!res.ok) {
          const data = await res.json();
          const msg = data.details || data.error || 'Drive-Upload fehlgeschlagen';
          console.error('[Images] Drive upload failed:', msg);
          setError(msg);
        }
        await fetchProduct();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Drive-Upload fehlgeschlagen';
        console.error('[Images] Drive upload trigger failed:', msg);
        setError(msg);
        await fetchProduct();
      }
    };

    triggerUpload();
  }, [product?.status, id, fetchProduct]);

  const handleProcessImages = async () => {
    if (!product) return;

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(withBasePath(`/api/products/${id}/process`), {
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

  const handleRetryDriveUpload = async () => {
    if (!product) return;

    setError(null);

    try {
      const res = await fetch(withBasePath(`/api/products/${id}/upload`), {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.details || 'Drive-Upload fehlgeschlagen');
      }

      await fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Drive-Upload fehlgeschlagen');
      await fetchProduct();
    }
  };

  const handleDeleteProduct = async () => {
    if (!confirm('Produkt und alle Bilder wirklich löschen?')) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(withBasePath(`/api/products/${id}`), { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Löschen fehlgeschlagen');
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setDeleting(false);
    }
  };

  const handleReclassify = async () => {
    setClassifying(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/products/${id}/classify`), { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Klassifizierung fehlgeschlagen');
      }
      const data = await res.json();
      if (data.classified) {
        setMissingViewLabels(data.missingLabels || []);
      }
      await fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klassifizierung fehlgeschlagen');
    } finally {
      setClassifying(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Bild wirklich löschen?')) return;

    try {
      const res = await fetch(withBasePath(`/api/products/${id}/images/${imageId}`), {
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
      pending: 'bg-muted text-muted-foreground',
      processing: 'bg-blue-900/30 text-blue-400',
      done: 'bg-green-900/30 text-green-400',
      error: 'bg-destructive/20 text-destructive',
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
        <div className="animate-spin w-8 h-8 border-2 border-border border-t-foreground rounded-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Produkt nicht gefunden</p>
        <Button onClick={() => router.push('/')} className="mt-4">
          Zurück zum Scanner
        </Button>
      </div>
    );
  }

  const isShoe = isShoeCategory(product.category);
  const images = [...(product.images || [])].sort((a, b) => a.sortOrder - b.sortOrder);
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
            className="text-sm text-muted-foreground hover:text-foreground mb-1"
          >
            ← Zurück
          </button>
          <h1 className="text-xl font-semibold text-foreground">
            Bilder: {product.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kategorie: {product.category}
          </p>
        </div>
        <button
          onClick={handleDeleteProduct}
          disabled={isBusy || deleting}
          title="Produkt löschen"
          className="p-2 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {deleting ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Progress bar during processing/uploading */}
      {(isBusy || isUploaded || isDriveError) && totalImages > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {getPhaseLabel(product.status)}
            </span>
            <span className="text-muted-foreground">
              {isUploading
                ? 'Drive-Upload...'
                : isUploaded
                  ? `${processedCount} von ${totalImages} Bildern`
                  : `${processedCount} von ${totalImages} Bildern verarbeitet`}
            </span>
          </div>

          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
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
            <p className="text-xs text-muted-foreground">
              Bilder werden zu Google Drive hochgeladen...
            </p>
          )}
        </div>
      )}

      {/* Success: uploaded to Drive */}
      {isUploaded && (
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium text-green-400">
              Produkt erfolgreich hochgeladen!
            </span>
          </div>
          {product.driveUrl && (
            <a
              href={product.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-400 hover:underline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              In Google Drive öffnen
            </a>
          )}
        </div>
      )}

      {/* Drive error with retry button */}
      {isDriveError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="font-medium text-destructive">
              Drive-Upload fehlgeschlagen
            </span>
          </div>
          <p className="text-sm text-destructive">
            Die Bilder wurden verarbeitet, aber der Upload zu Google Drive ist fehlgeschlagen.
          </p>
          <button
            onClick={handleRetryDriveUpload}
            disabled={isBusy}
            className="w-full py-2.5 px-4 bg-destructive/20 hover:bg-destructive/30 text-destructive rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Drive-Upload erneut versuchen
          </button>
        </div>
      )}

      {/* Next product button */}
      {showNextProduct && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-3">
          <Link
            href="/"
            className="block w-full text-center bg-primary hover:bg-primary/80 text-primary-foreground font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Naechstes Produkt scannen
          </Link>
          {isBusy && (
            <p className="text-xs text-primary text-center">
              Die Bilder werden im Hintergrund weiterverarbeitet.
            </p>
          )}
        </div>
      )}

      {isShoe && guidedCaptureOpen && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-medium text-foreground mb-3">
            Geführte Aufnahme
          </h2>
          <GuidedPhotoCapture
            productId={id}
            existingSortOrders={images.map((img) => img.sortOrder)}
            onUploadComplete={fetchProduct}
            onAllCaptured={() => setGuidedCaptureOpen(false)}
            onCancel={() => setGuidedCaptureOpen(false)}
          />
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-foreground">
            Bilder hochladen
          </h2>
          {isShoe && !guidedCaptureOpen && (
            <button
              onClick={() => setGuidedCaptureOpen(true)}
              disabled={isBusy}
              className="min-h-11 flex items-center gap-1.5 px-3 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Geführte Aufnahme starten
            </button>
          )}
        </div>
        <ImageUploader
          productId={id}
          category={product.category}
          existingImageCount={images.length}
          onUploadComplete={fetchProduct}
          onClassifyComplete={(result) => setMissingViewLabels(result.missingLabels)}
        />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-foreground">
              {images.length}
            </p>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-muted-foreground">
              {pendingImages.length}
            </p>
            <p className="text-xs text-muted-foreground">Ausstehend</p>
          </div>
          <div className="bg-blue-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-blue-400">
              {processingImages.length}
            </p>
            <p className="text-xs text-blue-400">In Arbeit</p>
          </div>
          <div className="bg-green-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-semibold text-green-400">
              {doneImages.length}
            </p>
            <p className="text-xs text-green-400">Fertig</p>
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

      {/* Shoe classification overview */}
      {isShoe && images.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              Schuh-Ansichten
            </h2>
            <button
              onClick={handleReclassify}
              disabled={classifying || isBusy}
              className="text-xs text-primary hover:text-primary/80 disabled:opacity-50"
            >
              {classifying ? 'Klassifiziert...' : 'Neu klassifizieren'}
            </button>
          </div>
          <ShoeViewOverview images={images} />
          {missingViewLabels.length > 0 && (
            <MissingViewsBar missingLabels={missingViewLabels} />
          )}
        </div>
      )}

      {images.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-medium text-foreground mb-3">
            Alle Bilder
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative group rounded-lg overflow-hidden bg-muted aspect-square"
              >
                <img
                  src={image.processedPath || image.originalPath}
                  alt={image.filename}
                  className="w-full h-full object-contain"
                />

                <div className="absolute top-2 left-2 flex items-center gap-1">
                  {getStatusBadge(image.status)}
                  <ShoeViewBadge sortOrder={image.sortOrder} isShoe={isShoe} />
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
                    className="p-2 bg-card rounded-full hover:bg-muted"
                    title="Original ansehen"
                  >
                    <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="text-center py-12 text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>Noch keine Bilder hochgeladen</p>
        </div>
      )}
    </div>
  );
}
