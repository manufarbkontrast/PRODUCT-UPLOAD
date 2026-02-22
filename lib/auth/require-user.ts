import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Defense-in-depth: verify user session inside route handlers,
 * not just in middleware. Returns the authenticated user or a 401 response.
 */
export async function requireUser(): Promise<
  | { user: { id: string; email?: string }; error: null }
  | { user: null; error: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 }),
    };
  }

  return { user, error: null };
}
