-- Record card finish on marketplace listings and support finish filtering.
alter table public.listings
  add column if not exists finish text not null default 'non_holo'
  check (finish in ('non_holo','holofoil','reverse','stamped','other'));

create index if not exists listings_finish_idx on public.listings(finish);
