'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ViewMode = 'auto' | 'mobile' | 'desktop';

interface ViewModeContextType {
  viewMode: ViewMode;
  isMobile: boolean;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextType>({
  viewMode: 'auto',
  isMobile: false,
  setViewMode: () => {},
  toggleViewMode: () => {},
});

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('auto');
  const [screenIsMobile, setScreenIsMobile] = useState(false);

  // Detect screen size
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setScreenIsMobile(mq.matches);

    const handler = (e: MediaQueryListEvent) => setScreenIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load saved preference (mit try-catch fuer Private Browsing)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('spz-view-mode') as ViewMode | null;
      if (saved && ['auto', 'mobile', 'desktop'].includes(saved)) {
        setViewMode(saved);
      }
    } catch { /* localStorage nicht verfuegbar */ }
  }, []);

  // Save preference
  useEffect(() => {
    try {
      localStorage.setItem('spz-view-mode', viewMode);
    } catch { /* localStorage nicht verfuegbar */ }
  }, [viewMode]);

  const isMobile =
    viewMode === 'mobile' ? true :
    viewMode === 'desktop' ? false :
    screenIsMobile;

  const toggleViewMode = () => {
    if (viewMode === 'auto') {
      setViewMode(screenIsMobile ? 'desktop' : 'mobile');
    } else if (viewMode === 'mobile') {
      setViewMode('desktop');
    } else {
      setViewMode('auto');
    }
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, isMobile, setViewMode, toggleViewMode }}>
      <div className={isMobile ? 'view-mobile' : 'view-desktop'}>
        {children}
      </div>
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
