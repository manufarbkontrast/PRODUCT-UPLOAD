'use client';

import { useEffect } from 'react';

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[App Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-extrabold text-foreground">
          Etwas ist schiefgelaufen
        </h2>
        <p className="text-muted-foreground">
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
        </p>
        <button
          onClick={reset}
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
