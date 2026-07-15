'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { withBasePath } from '@/lib/base-path';
import type { User, SupabaseClient } from '@supabase/supabase-js';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  logout: async () => {},
});

function useSupabaseClient(): SupabaseClient | null {
  // Lazy-Init über useState statt Ref: erzeugt den Client genau einmal
  // (Initializer läuft nur beim ersten Render) und greift NICHT während des
  // Renders auf ref.current zu (react-hooks/refs).
  const [client] = useState<SupabaseClient | null>(() => {
    try {
      return createClient();
    } catch {
      // Env vars missing (e.g. during static build) — client unavailable.
      return null;
    }
  });
  return client;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useSupabaseClient();

  const checkAuth = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkAuth, supabase]);

  // Re-check on route change
  useEffect(() => {
    checkAuth();
  }, [pathname, checkAuth]);

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Auch serverseitig: loescht die Supabase-SSR-Cookies
    try {
      await fetch(withBasePath('/api/auth/logout'), { method: 'POST' });
    } catch {
      // Ignorieren — Client-Signout + Redirect reichen im Zweifel
    }
    setUser(null);
    router.push('/login');
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: !!user, isLoading, user, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
