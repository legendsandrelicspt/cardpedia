-- Restore the minimum table privileges required by the Cardpedia browser client.
-- Row Level Security policies remain the authority for which rows users can access.
grant select on table public.listings to anon, authenticated;
grant insert, update on table public.listings to authenticated;
