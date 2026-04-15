-- Profiles table for filiale assignments.
-- Each authenticated user maps to exactly one filiale code.
-- Used by /api/reorder to stamp the filiale into the reorder sheet and
-- to enforce that a filiale can only act on behalf of itself.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  filiale text not null check (filiale in ('J&C','SPZ','SPR','SPSW','SPW')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile (needed for client-side filiale display).
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  using (auth.uid() = user_id);

-- Only the service role may insert/update/delete; admins seed filiale assignments.
-- No insert/update/delete policies for authenticated users on purpose.
