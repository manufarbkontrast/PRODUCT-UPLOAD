import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export const FILIALE_CODES = ['J&C', 'SPZ', 'SPR', 'SPSW', 'SPW'] as const;
export type FilialeCode = typeof FILIALE_CODES[number];

export function isFilialeCode(value: string): value is FilialeCode {
  return (FILIALE_CODES as readonly string[]).includes(value);
}

/**
 * Resolve the current Supabase user's filiale from the profiles table.
 * Returns either { filiale, userId } or an error NextResponse (401/403).
 */
export async function requireFiliale(): Promise<
  | { filiale: FilialeCode; userId: string; error: null }
  | { filiale: null; userId: null; error: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      filiale: null,
      userId: null,
      error: NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 }),
    };
  }

  // Use service-role client: profiles RLS only allows the owner to select,
  // but service-role bypasses RLS so this works uniformly for every user.
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from('profiles')
    .select('filiale')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data || !isFilialeCode(data.filiale)) {
    return {
      filiale: null,
      userId: null,
      error: NextResponse.json(
        { error: 'Keine Filiale zugewiesen' },
        { status: 403 }
      ),
    };
  }

  return { filiale: data.filiale, userId: user.id, error: null };
}
