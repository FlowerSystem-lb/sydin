-- SydIN Phase 14: enforce the plan item limit in the database
-- Run manually in the Supabase SQL editor after reviewing.
--
-- Why this exists
-- ---------------
-- The Free/Standard/Pro item caps (50 / 250 / 1000) were only ever checked in
-- the browser, in app/lib/subscription.ts. Row Level Security already stops one
-- customer reading another's data, so this is not a data-leak fix -- it is a
-- billing-integrity fix. Without it, anyone who can call the Supabase API
-- directly can hold more items than they pay for, and the limit is
-- unenforceable at launch.
--
-- The numbers below are duplicated from PLAN_ITEM_LIMITS in
-- app/lib/subscription.ts. That duplication is deliberate: Postgres cannot read
-- the TypeScript constant, and a wrong guess here would silently reject a
-- paying customer's writes. If those limits ever change, this function must be
-- updated in the same commit.
--
-- Deliberately conservative
-- -------------------------
--   * BEFORE INSERT only. Updates and deletes are never blocked, so an
--     over-limit account (from before this migration, or after a downgrade)
--     can still edit and delete its way back down instead of being frozen.
--   * A missing or inactive subscription row resolves to the Free limit, which
--     mirrors getUserSubscription()'s own fallback in the app.
--   * Counts rows the same way the app does: inventory rows for that user_id.
--
-- Rollback is at the bottom of this file.

begin;

create or replace function public.enforce_plan_item_limit()
returns trigger
language plpgsql
security definer
-- Pinned so a caller cannot shadow `public` with their own objects; this
-- function runs as its owner because it reads user_subscriptions, which the
-- inserting user may not be able to select for themselves.
set search_path = public, pg_temp
as $$
declare
  current_plan text;
  current_status text;
  plan_limit integer;
  used_items integer;
begin
  -- Same ownership guard as enforce_pick_list_active_limit() in
  -- sql/phase-7-pick-lists.sql. Safe today because nothing inserts inventory
  -- with the service-role key -- getSupabaseAdmin() is only used by the
  -- /api/admin plan-request routes, verified before adding this. If a
  -- server-side importer is ever added, it will need auth context or this
  -- guard has to be relaxed for it.
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Inventory item must belong to the authenticated user.'
      using errcode = '42501';
  end if;

  select lower(btrim(plan)), lower(btrim(status))
    into current_plan, current_status
    from public.user_subscriptions
   where user_id = new.user_id;

  -- Matches isActiveStatus() and normalizePlan() in app/lib/subscription.ts
  -- exactly: only the literal 'active' counts, compared case-insensitively
  -- and trimmed, and anything that is not standard/pro resolves to free.
  -- Accepting 'trialing' here (or any other status the app rejects) would let
  -- the database and the UI disagree about who is allowed to add items.
  -- Also collapses the no-row case: SELECT INTO leaves both NULL, so this
  -- resolves to 'free' rather than leaving NULL to print in the error below.
  if current_status is distinct from 'active' then
    current_plan := 'free';
  end if;

  current_plan := coalesce(current_plan, 'free');

  plan_limit := case current_plan
    when 'pro' then 1000
    when 'standard' then 250
    else 50
  end;

  select count(*)
    into used_items
    from public.inventory
   where user_id = new.user_id;

  if used_items >= plan_limit then
    raise exception
      'Item limit reached for the % plan (% of % items). Upgrade to add more.',
      current_plan, used_items, plan_limit
      -- P0001 matches the Pick List limit error already in production, so any
      -- client-side handling of "plan limit hit" sees one consistent code.
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_plan_item_limit on public.inventory;

create trigger trg_enforce_plan_item_limit
  before insert on public.inventory
  for each row
  execute function public.enforce_plan_item_limit();

commit;

-- Check which accounts are already over their cap. This does not change
-- anything; existing rows are left alone on purpose (see note above).
--
--   select s.user_id,
--          coalesce(s.plan, 'free') as plan,
--          count(i.id) as items
--     from public.user_subscriptions s
--     left join public.inventory i on i.user_id = s.user_id
--    group by s.user_id, s.plan
--    order by items desc;

-- Rollback
-- --------
--   begin;
--   drop trigger if exists trg_enforce_plan_item_limit on public.inventory;
--   drop function if exists public.enforce_plan_item_limit();
--   commit;
