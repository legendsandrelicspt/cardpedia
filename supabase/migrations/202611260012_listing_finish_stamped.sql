-- Add stamped as a supported card finish.
alter table public.listings
  drop constraint if exists listings_finish_check;

alter table public.listings
  add constraint listings_finish_check
  check (finish in ('non_holo','holofoil','reverse','stamped','other'));
