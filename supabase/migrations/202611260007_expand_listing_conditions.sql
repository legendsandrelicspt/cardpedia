-- Expand Cardpedia's condition vocabulary while preserving existing listings.
alter table public.listings
  drop constraint if exists listings_condition_check;

alter table public.listings
  add constraint listings_condition_check
  check (condition in (
    'mint',
    'near_mint',
    'excellent',
    'good',
    'lightly_played',
    'played',
    'poor',
    'moderately_played',
    'heavily_played',
    'damaged',
    'graded',
    'sealed'
  ));
