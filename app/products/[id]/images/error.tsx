'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ImagesErrorPage({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  useEffect(() => {
    console.error('[Images Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-4xl">📷</div>
        <h2 className="text-xl font-extrabold text-foreground">
          Fehler bei der Bildverarbeitung
        </h2>
        <p className="text-muted-foreground">
          Beim Laden oder Verarbeiten der Bilder ist ein Fehler aufgetreten.
        </p>
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={reset}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors"
          >
            Erneut versuchen
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/70 transition-colors"
          >
            Zur Startseite
          </button>
        </div>
      </div>
    </div>
  );
}
