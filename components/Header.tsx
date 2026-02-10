'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isMobile } = useViewMode();
  const { logout } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className={`mx-auto px-4 ${isMobile ? 'max-w-lg' : 'max-w-5xl'}`}>
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white dark:text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="text-base font-semibold">SPZ</span>
          </Link>

          {/* Desktop Navigation */}
          {!isMobile && (
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('/') ? 'bg-zinc-100 dark:bg-zinc-800 font-medium' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
              >
                Dashboard
              </Link>
              <Link
                href="/products"
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('/products') ? 'bg-zinc-100 dark:bg-zinc-800 font-medium' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}
              >
                Produkte
              </Link>
              <Link
                href="/products/new"
                className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium ml-2"
              >
                + Neu
              </Link>

              <button
                onClick={logout}
                className="ml-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                title="Abmelden"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </nav>
          )}

          {/* Mobile: Hamburger */}
          {isMobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Menü"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>

        {/* Mobile Menu */}
        {isMobile && menuOpen && (
          <nav className="pb-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex flex-col gap-0.5 mt-2">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2.5 rounded-lg text-sm ${isActive('/') ? 'bg-zinc-100 dark:bg-zinc-800 font-medium' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'}`}
              >
                Dashboard
              </Link>
              <Link
                href="/products"
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2.5 rounded-lg text-sm ${isActive('/products') ? 'bg-zinc-100 dark:bg-zinc-800 font-medium' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'}`}
              >
                Alle Produkte
              </Link>
              <Link
                href="/products/new"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm text-center font-medium mt-1"
              >
                + Neues Produkt
              </Link>
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="px-3 py-2.5 rounded-lg text-sm text-left text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 mt-1"
              >
                Abmelden
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
