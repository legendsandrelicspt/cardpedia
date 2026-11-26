-- Cardpedia Storage policies for seller-uploaded listing photographs.
-- Bucket ID must match the exact bucket created in Supabase.
-- Object path format: <seller_user_id>/<listing_id>/<filename>
-- The bucket is public for reads; public bucket reads do not require an object SELECT policy.
-- Upload, update and delete are restricted to the listing owner.

create policy "Cardpedia sellers upload own listing images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'Cardpedia-listings'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.seller_id = auth.uid()
  )
);

create policy "Cardpedia sellers update own listing images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'Cardpedia-listings'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.seller_id = auth.uid()
  )
)
with check (
  bucket_id = 'Cardpedia-listings'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.seller_id = auth.uid()
  )
);

create policy "Cardpedia sellers delete own listing images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'Cardpedia-listings'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.seller_id = auth.uid()
  )
);
