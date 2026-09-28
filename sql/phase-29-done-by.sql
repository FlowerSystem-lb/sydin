-- SydIN Phase 29: "done by" -- who in the team made each change
--
-- Phase 28 started recording actor_id (the login that pressed the button) on
-- inventory_history, stock_movements, sales_orders and purchase_orders. This
-- file adds the same to deliveries received, payments and pick lists, and a
-- read-only function that turns those ids into names -- only for the people of
-- YOUR OWN business (owner + active members), for anyone in that business.
--
-- Additive only: two new nullable columns per table and one function. Nothing
-- existing changes. Run in Supabase > SQL Editor.

begin;

alter table public.purchase_order_receipts
  add column if not exists actor_id uuid null default auth.uid() references auth.users (id) on delete set null;
alter table public.sales_order_payments
  add column if not exists actor_id uuid null default auth.uid() references auth.users (id) on delete set null;
alter table public.purchase_order_payments
  add column if not exists actor_id uuid null default auth.uid() references auth.users (id) on delete set null;
alter table public.pick_lists
  add column if not exists actor_id uuid null default auth.uid() references auth.users (id) on delete set null;

-- Name shown in "by ...": the name given when the login was created, else the
-- Google/Microsoft name, else the part of the email before the @.
create or replace function public.business_people()
returns table (user_id uuid, display_name text, email text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  with business as (select public.current_business_id() as id)
  select u.id,
         coalesce(
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
           split_part(u.email::text, '@', 1)
         ),
         lower(u.email::text),
         'owner'
    from auth.users u, business b
   where u.id = b.id
  union all
  select u.id,
         coalesce(
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
           split_part(u.email::text, '@', 1)
         ),
         lower(u.email::text),
         bm.role
    from public.business_members bm
    join auth.users u on u.id = bm.member_id
    join business b on bm.owner_id = b.id
   where bm.status = 'active';
$$;

revoke all on function public.business_people() from public, anon;
grant execute on function public.business_people() to authenticated;

commit;

-- ROLLBACK (only to undo this file):
-- begin;
-- drop function if exists public.business_people();
-- alter table public.purchase_order_receipts drop column if exists actor_id;
-- alter table public.sales_order_payments drop column if exists actor_id;
-- alter table public.purchase_order_payments drop column if exists actor_id;
-- alter table public.pick_lists drop column if exists actor_id;
-- commit;
