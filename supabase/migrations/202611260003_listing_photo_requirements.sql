-- Cardpedia listing photo requirements and database-side publication checks.
alter table public.listings
  add column if not exists rarity text not null default 'unknown',
  add column if not exists has_defects boolean not null default false;

alter table public.listing_images
  add column if not exists image_type text not null default 'detail'
  check (image_type in ('front','back','detail','defect'));

grant insert, update on public.listings to authenticated;
grant select, insert, delete on public.listing_images to authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

-- Listing images are seller-uploaded photographs, not publisher artwork.
-- Public read is enabled so buyers can view photos of active listings.
update storage.buckets set public = true where id = 'Cardpedia-listings';

create or replace function public.cardpedia_validate_listing_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  front_count integer;
  back_count integer;
  detail_count integer;
  defect_count integer;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    select
      count(*) filter (where image_type = 'front'),
      count(*) filter (where image_type = 'back'),
      count(*) filter (where image_type in ('detail','defect')),
      count(*) filter (where image_type = 'defect')
    into front_count, back_count, detail_count, defect_count
    from public.listing_images
    where listing_id = new.id;

    if front_count < 1 or back_count < 1 then
      raise exception 'A listing needs at least one front and one back photo.';
    end if;

    if lower(coalesce(new.rarity, 'unknown')) in ('rare','double rare','ultra rare','illustration rare','special illustration rare','hyper rare','secret rare','mythic rare','rare mythic','rare ultra','rare secret','manga rare','leader rare','enchanted','legendary','epic','showcase') and detail_count < 2 then
      raise exception 'Rare and higher cards need at least two additional detail photos.';
    end if;

    if new.has_defects and defect_count < 1 then
      raise exception 'Reported damage or imperfections must have at least one photo.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cardpedia_validate_listing_publication on public.listings;
create trigger cardpedia_validate_listing_publication
before update of status on public.listings
for each row execute function public.cardpedia_validate_listing_publication();
