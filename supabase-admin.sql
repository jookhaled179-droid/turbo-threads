-- Run once in Supabase → SQL Editor AFTER supabase-orders.sql
-- and AFTER creating your admin user in Authentication → Users.

-- 1) Admins list (only accounts listed here can see / edit orders)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
-- No policies on admins = nobody can read or change it from the website.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- 2) Admins can read and update orders
drop policy if exists "admins can read orders" on public.orders;
create policy "admins can read orders" on public.orders
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admins can update orders" on public.orders;
create policy "admins can update orders" on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3) Make your account an admin: put YOUR email here, then run
insert into public.admins (user_id)
select id from auth.users where email = 'youssef@gmail.com'
on conflict do nothing;
