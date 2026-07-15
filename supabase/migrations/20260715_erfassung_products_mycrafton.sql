-- Erfassungs-Tool (Produkt-Upload): Produkte + Bilder in mycrafton.
-- RLS aktiv OHNE permissive Policies -> nur Service-Role (App-Schicht) hat Zugriff.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  ean text, name text, gender text, category text,
  description text, sku text,
  status text not null default 'draft'
    check (status in ('draft','processing','processed','uploading','uploaded','error','drive_error')),
  drive_url text, zalando_attributes jsonb,
  filiale text,
  erfasst_von uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists products_ean_unique on public.products (ean) where ean is not null;
create index if not exists products_status_idx on public.products (status);
create index if not exists products_created_idx on public.products (created_at desc);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  original_path text, processed_path text, filename text,
  sort_order int not null default 0,
  status text not null default 'pending' check (status in ('pending','processing','done','error')),
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);

alter table public.products enable row level security;
alter table public.product_images enable row level security;

insert into storage.buckets (id, name, public)
  values ('product-images','product-images', false), ('processed-images','processed-images', false)
  on conflict (id) do nothing;
