-- Grant the read privileges required for the public marketplace query and signed URLs.
grant select on table public.listing_images to anon, authenticated;
grant select on table storage.objects to anon, authenticated;

-- Allow visitors to request signed URLs for photos attached to active listings.
-- The bucket remains private; draft and withdrawn photos remain inaccessible to visitors.
drop policy if exists "Cardpedia visitors read active listing photos" on storage.objects;
create policy "Cardpedia visitors read active listing photos"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'Cardpedia-listings'
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.status = 'active'
  )
);
