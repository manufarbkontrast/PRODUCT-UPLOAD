'use client';

import { useViewMode } from '@/contexts/ViewModeContext';

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { isMobile } = useViewMode();

  return (
    <main className={`mx-auto px-4 py-4 pb-20 ${isMobile ? 'max-w-lg' : 'max-w-5xl px-8'}`}>
      {children}
    </main>
  );
}
