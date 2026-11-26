insert into public.games (id, name, slug)
values ('sealed', 'Sealed Products', 'sealed-products')
on conflict (id) do nothing;
