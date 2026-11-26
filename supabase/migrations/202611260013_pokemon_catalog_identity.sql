-- Store external Pokémon catalogue identity on listings without copying artwork.
alter table public.listings
  add column if not exists catalog_source text,
  add column if not exists catalog_card_id text;

create index if not exists listings_catalog_card_idx
  on public.listings(catalog_source, catalog_card_id)
  where catalog_card_id is not null;
