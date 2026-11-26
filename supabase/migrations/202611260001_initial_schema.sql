-- Cardpedia initial PostgreSQL schema for Supabase
-- Starter migration. Review and test in a non-production project before launch.
-- No publisher-owned artwork or imported datasets are included.

create extension if not exists pgcrypto;

create table if not exists public.games (
  id text primary key,
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.games (id, name, slug) values
  ('pokemon', 'Pokémon', 'pokemon'),
  ('mtg', 'Magic: The Gathering', 'mtg'),
  ('yugioh', 'Yu-Gi-Oh!', 'yugioh'),
  ('onepiece', 'One Piece Card Game', 'onepiece'),
  ('lorcana', 'Disney Lorcana', 'lorcana'),
  ('riftbound', 'Riftbound', 'riftbound')
on conflict (id) do nothing;

create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  website_url text,
  terms_url text,
  commercial_use_status text not null default 'review_required'
    check (commercial_use_status in ('review_required', 'approved', 'restricted', 'rejected', 'expired')),
  approved_scope text,
  approval_reference text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.card_sets (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id),
  name text not null,
  code text,
  release_date date,
  language text,
  source_id uuid references public.data_sources(id),
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (game_id, source_id, external_id)
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id),
  canonical_name text not null,
  normalized_name text not null,
  card_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cards_game_name_idx on public.cards(game_id, normalized_name);

create table if not exists public.printings (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  set_id uuid references public.card_sets(id),
  source_id uuid references public.data_sources(id),
  external_id text,
  collector_number text,
  language text,
  finish text,
  rarity text,
  edition text,
  image_url text,
  image_rights_status text not null default 'not_cleared'
    check (image_rights_status in ('not_cleared', 'source_display_only', 'licensed', 'user_uploaded', 'not_used')),
  image_rights_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);
create index if not exists printings_card_idx on public.printings(card_id);
create index if not exists printings_set_idx on public.printings(set_id);

-- Only public profile fields belong here. Never add email, phone or private account data.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  country_code char(2),
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id),
  printing_id uuid references public.printings(id),
  game_id text not null references public.games(id),
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 5000),
  listing_type text not null check (listing_type in ('sale', 'trade', 'sale_or_trade')),
  condition text not null check (condition in ('mint', 'near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged', 'sealed', 'graded')),
  language text,
  price_amount numeric(12,2),
  currency char(3) not null default 'EUR',
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'reserved', 'sold', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((listing_type = 'trade') or price_amount is not null),
  check (price_amount is null or price_amount >= 0)
);
create index if not exists listings_browse_idx on public.listings(status, game_id, created_at desc);
create index if not exists listings_seller_idx on public.listings(seller_id, created_at desc);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (storage_path)
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  buyer_id uuid not null references auth.users(id),
  seller_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create index if not exists conversations_participants_idx on public.conversations(buyer_id, seller_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);

-- Orders are readable by their participants. Creation and state transitions must go
-- through a server-side function after validating listing, seller, quantity and price.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  buyer_id uuid not null references auth.users(id),
  seller_id uuid not null references auth.users(id),
  quantity integer not null default 1 check (quantity > 0),
  item_total numeric(12,2) not null check (item_total >= 0),
  currency char(3) not null default 'EUR',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled', 'dispatched', 'delivered', 'completed', 'disputed')),
  payment_provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

alter table public.games enable row level security;
alter table public.data_sources enable row level security;
alter table public.card_sets enable row level security;
alter table public.cards enable row level security;
alter table public.printings enable row level security;
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.orders enable row level security;

-- Public catalogue tables contain only records approved for Cardpedia publication.
create policy games_read on public.games for select using (is_active = true);
create policy sets_read on public.card_sets for select using (true);
create policy cards_read on public.cards for select using (true);
create policy printings_read on public.printings for select using (true);

-- Public users see active listings; sellers can also see their own drafts/withdrawn listings.
create policy active_listings_read on public.listings
  for select using (status = 'active' or seller_id = auth.uid());
create policy seller_insert_draft_listing on public.listings
  for insert to authenticated with check (seller_id = auth.uid() and status = 'draft');
create policy seller_update_listing on public.listings
  for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy seller_delete_listing on public.listings
  for delete to authenticated using (seller_id = auth.uid());

-- Profiles contain public-facing fields only; private account data stays in auth.users.
create policy profile_read_public on public.profiles for select using (true);
create policy profile_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profile_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy listing_images_read on public.listing_images for select
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and (l.status = 'active' or l.seller_id = auth.uid())
  ));
create policy listing_images_insert_owner on public.listing_images for insert to authenticated
  with check (exists (
    select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()
  ));
create policy listing_images_delete_owner on public.listing_images for delete to authenticated
  using (exists (
    select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()
  ));

create policy favorites_read_self on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_insert_self on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy favorites_delete_self on public.favorites for delete to authenticated using (user_id = auth.uid());

create policy conversations_read_participant on public.conversations
  for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy conversations_insert_buyer on public.conversations
  for insert to authenticated with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = seller_id
        and l.status = 'active' and l.seller_id <> auth.uid()
    )
  );

create policy messages_read_participant on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  ));
create policy messages_insert_participant on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

create policy orders_read_participant on public.orders for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());
-- Intentionally no client INSERT/UPDATE/DELETE policy for orders.
-- A validated server-side order function is required before checkout is enabled.

-- data_sources is internal and intentionally has no client-facing read/write policy.
