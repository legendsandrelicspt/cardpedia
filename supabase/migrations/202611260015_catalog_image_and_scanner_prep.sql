-- Store the catalogue artwork URL for the selected Pokémon printing.
alter table public.listings add column if not exists catalog_image_url text;
