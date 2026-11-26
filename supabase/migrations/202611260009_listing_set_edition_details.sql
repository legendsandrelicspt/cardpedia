-- Store set, collection and edition details directly on marketplace listings.
alter table public.listings
  add column if not exists set_id uuid references public.card_sets(id) on delete set null,
  add column if not exists set_name text,
  add column if not exists set_code text,
  add column if not exists collector_number text,
  add column if not exists edition text;

create index if not exists listings_set_id_idx on public.listings(set_id);
