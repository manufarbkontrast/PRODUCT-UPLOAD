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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Fehler bei der Bildverarbeitung
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Beim Laden oder Verarbeiten der Bilder ist ein Fehler aufgetreten.
        </p>
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={reset}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Erneut versuchen
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Zur Startseite
          </button>
        </div>
      </div>
    </div>
  );
}
