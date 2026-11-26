-- Add grading metadata and a dedicated grading-label photo type.
alter table public.listings
  add column if not exists grading_company text,
  add column if not exists grading_grade text,
  add column if not exists grading_certification_number text;

alter table public.listing_images
  drop constraint if exists listing_images_image_type_check;

alter table public.listing_images
  add constraint listing_images_image_type_check
  check (image_type in ('front','back','detail','defect','grading_label'));

-- Keep existing photo rules and add proof requirements for graded items.
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
  grading_label_count integer;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    select
      count(*) filter (where image_type = 'front'),
      count(*) filter (where image_type = 'back'),
      count(*) filter (where image_type = 'defect'),
      count(*) filter (where image_type = 'grading_label')
    into front_count, back_count, defect_count, grading_label_count
    from public.listing_images
    where listing_id = new.id;

    if new.condition in ('mint','near_mint') and coalesce(new.price_amount, 0) > 5
       and (front_count < 1 or back_count < 1) then
      raise exception 'Mint / Near Mint cards priced above EUR 5 require front and back photos.';
    end if;

    if new.condition in ('mint','near_mint') and new.has_defects and defect_count < 1 then
      raise exception 'Reported damage or imperfections must have at least one photo.';
    end if;

    if new.condition = 'graded' then
      if nullif(trim(coalesce(new.grading_company, '')), '') is null
         or nullif(trim(coalesce(new.grading_grade, '')), '') is null then
        raise exception 'Graded listings require a grading company and grade.';
      end if;
      if front_count < 1 or grading_label_count < 1 then
        raise exception 'Graded listings require a front photo and a grading-label photo.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cardpedia_validate_listing_publication on public.listings;
create trigger cardpedia_validate_listing_publication
before update of status on public.listings
for each row execute function public.cardpedia_validate_listing_publication();
