'use client';

import { useRouter } from 'next/navigation';

const MODES = [
  {
    id: 'abfrage',
    title: 'Artikel Abfrage',
    description: 'EAN scannen und Artikelinformationen abrufen',
    href: '/abfrage',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'fotografieren',
    title: 'Artikel Fotografieren',
    description: 'EAN scannen, Bilder aufnehmen und hochladen',
    href: '/fotografieren',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
] as const;

export default function Home() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="text-center pt-4">
        <h1 className="text-2xl font-extrabold">Was moechtest du tun?</h1>
        <p className="text-sm text-muted-foreground mt-1">Waehle eine Option</p>
      </div>

      <div className="grid gap-4">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => router.push(mode.href)}
            className="flex items-center gap-5 w-full p-5 border border-border bg-card rounded-2xl hover:bg-muted text-left transition-colors"
          >
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
              {mode.icon}
            </div>
            <div>
              <p className="text-base font-semibold">{mode.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{mode.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
