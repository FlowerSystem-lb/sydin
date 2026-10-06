-- Phase 37: depot contact, location and default (6 Oct 2026, Sayed's Depots redesign).
-- Additive only: four nullable/defaulted columns, two partial unique indexes and
-- one SECURITY INVOKER function, so the existing RLS policies on `depots` keep
-- deciding who can read and write every row.

alter table public.depots
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists map_url text,
  add column if not exists is_default boolean not null default false;

-- A code identifies a depot inside one business ("used in PO numbers"), so two
-- depots of the same business must not share one. Case-insensitive; blank is
-- "no code" and may repeat. Checked live before this ran: no duplicates.
create unique index if not exists depots_user_code_unique
  on public.depots (user_id, upper(btrim(code)))
  where code is not null and btrim(code) <> '';

-- At most one default depot per business.
create unique index if not exists depots_one_default_per_business
  on public.depots (user_id)
  where is_default;

-- Make one depot the default and clear the previous one in one transaction
-- (a function body runs atomically). SECURITY INVOKER: the caller's RLS
-- applies to both updates, so a user can only touch their own business's
-- depots, exactly as with a direct update.
create or replace function public.set_default_depot(p_depot_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.depots where id = p_depot_id;
  if v_owner is null then
    raise exception 'Depot not found';
  end if;

  update public.depots
     set is_default = false, updated_at = now()
   where user_id = v_owner and is_default and id <> p_depot_id;

  update public.depots
     set is_default = true, updated_at = now()
   where id = p_depot_id;
end;
$$;

revoke all on function public.set_default_depot(bigint) from public;
grant execute on function public.set_default_depot(bigint) to authenticated;
