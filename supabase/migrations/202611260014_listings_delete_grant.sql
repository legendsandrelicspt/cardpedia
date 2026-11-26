-- Allow authenticated sellers to delete their own listings.
-- The seller_delete_listing RLS policy from the initial schema still restricts
-- deletion to rows where seller_id = auth.uid().
grant delete on table public.listings to authenticated;
