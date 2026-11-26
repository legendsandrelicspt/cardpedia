-- Cardpedia: account type and private registration addresses.
-- Professional accounts are free. Verification is a separate future status.

alter table public.profiles
  add column if not exists account_type text not null default 'individual'
  check (account_type in ('individual','professional'));

create table if not exists public.user_addresses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  country_code text not null,
  address_line1 text not null,
  address_line2 text,
  postal_code text not null,
  city text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_addresses enable row level security;

create policy user_addresses_read_self on public.user_addresses
  for select to authenticated using (user_id = auth.uid());
create policy user_addresses_insert_self on public.user_addresses
  for insert to authenticated with check (user_id = auth.uid());
create policy user_addresses_update_self on public.user_addresses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.business_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  vat_number text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_profiles enable row level security;

create policy business_profiles_read_self on public.business_profiles
  for select to authenticated using (user_id = auth.uid());
create policy business_profiles_insert_self on public.business_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy business_profiles_update_self on public.business_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create private registration data after signup, including when email confirmation is enabled.
create or replace function public.handle_new_cardpedia_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := new.raw_user_meta_data;
  account_type_value text := case
    when metadata->>'account_type' = 'professional' then 'professional'
    else 'individual'
  end;
begin
  insert into public.profiles (id, username, display_name, account_type)
  values (
    new.id,
    nullif(metadata->>'username',''),
    coalesce(nullif(metadata->>'username',''), split_part(new.email,'@',1)),
    account_type_value
  )
  on conflict (id) do update
    set account_type = excluded.account_type;

  if nullif(metadata->>'full_name','') is not null
     and nullif(metadata->>'address_line1','') is not null
     and nullif(metadata->>'postal_code','') is not null
     and nullif(metadata->>'city','') is not null then
    insert into public.user_addresses (
      user_id, full_name, country_code, address_line1, address_line2, postal_code, city
    ) values (
      new.id,
      metadata->>'full_name',
      coalesce(nullif(metadata->>'country_code',''),'PT'),
      metadata->>'address_line1',
      nullif(metadata->>'address_line2',''),
      metadata->>'postal_code',
      metadata->>'city'
    )
    on conflict (user_id) do update set
      full_name = excluded.full_name,
      country_code = excluded.country_code,
      address_line1 = excluded.address_line1,
      address_line2 = excluded.address_line2,
      postal_code = excluded.postal_code,
      city = excluded.city,
      updated_at = now();
  end if;

  if account_type_value = 'professional' and nullif(metadata->>'business_name','') is not null then
    insert into public.business_profiles (user_id, business_name, vat_number)
    values (new.id, metadata->>'business_name', nullif(metadata->>'vat_number',''))
    on conflict (user_id) do update set
      business_name = excluded.business_name,
      vat_number = excluded.vat_number,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_cardpedia_user_created on auth.users;
create trigger on_cardpedia_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_cardpedia_user();
