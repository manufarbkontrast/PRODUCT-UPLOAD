'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
  const ref = useRef<SupabaseClient | null>(null);
  if (ref.current === null) {
    try {
      ref.current = createClient();
    } catch {
      // Env vars missing (e.g. during static build) — client unavailable.
    }
  }
  return ref.current;
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
