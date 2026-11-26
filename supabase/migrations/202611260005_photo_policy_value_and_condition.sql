-- Cardpedia photo policy v2:
-- Front/back are mandatory only for Mint/Near Mint cards priced above EUR 5.
-- Rarity is deliberately not used as a photo requirement.
-- For Mint/Near Mint listings with declared imperfections, defect photos are required.
create or replace function public.cardpedia_validate_listing_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  front_count integer;
  back_count integer;
  defect_count integer;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    select
      count(*) filter (where image_type = 'front'),
      count(*) filter (where image_type = 'back'),
      count(*) filter (where image_type = 'defect')
    into front_count, back_count, defect_count
    from public.listing_images
    where listing_id = new.id;

    if new.condition in ('mint','near_mint') and coalesce(new.price_amount, 0) > 5
       and (front_count < 1 or back_count < 1) then
      raise exception 'Mint / Near Mint cards priced above EUR 5 require front and back photos.';
    end if;

    if new.condition in ('mint','near_mint') and new.has_defects and defect_count < 1 then
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
