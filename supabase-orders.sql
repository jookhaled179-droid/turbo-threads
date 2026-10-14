-- Run once in Supabase → SQL Editor. Creates the orders table used by html/store.js.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text not null check (phone ~ '^01[0125][0-9]{8}$'),
  governorate text not null,
  address text not null check (char_length(address) between 8 and 500),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  subtotal numeric not null check (subtotal >= 0),
  shipping numeric not null default 90,
  total numeric not null,
  channel text not null default 'website' check (channel in ('website', 'whatsapp')),
  status text not null default 'new' check (status in ('new', 'confirmed', 'shipped', 'delivered', 'cancelled'))
);

alter table public.orders enable row level security;

-- Customers (anon) can only INSERT new orders. They cannot read, edit or delete any order.
drop policy if exists "anon can place orders" on public.orders;
create policy "anon can place orders" on public.orders
  for insert to anon
  with check (status = 'new' and shipping = 90 and total = subtotal + shipping);
