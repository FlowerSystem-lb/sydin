-- ===========================================================================
-- Phase 15 — database function hardening
-- ===========================================================================
-- Closes three findings from the 2026-08-20 production audit. No table, column,
-- policy or business logic is changed: this only adjusts WHO may call each
-- function and pins the schema each one resolves names in.
--
-- Findings addressed
-- ------------------
-- 1. Functions callable without signing in.
--    Supabase exposes every function in `public` as a REST endpoint at
--    /rest/v1/rpc/<name>. 23 of them could be called by the `anon` role — that
--    is, by anyone on the internet with the project URL and the publishable
--    key, which ships in the browser bundle.
--
--    Most were protected anyway: `transfer_inventory_item_to_depot`,
--    `record_asset_event`, `complete_pick_list` and `receive_purchase_order`
--    each check `auth.uid()` and refuse a caller who is not signed in — I read
--    every one of them before writing this. The exception was
--    `recompute_purchase_order_payment(bigint)`, which has no check at all: a
--    stranger could pass any order id and force a recompute on another
--    business's purchase order. It only recalculates that order's own totals,
--    so nothing leaks and nothing false is written, but it should not be
--    reachable at all.
--
-- 2. Trigger functions exposed as API endpoints.
--    Roughly twenty of these are trigger bodies that were never meant to be
--    called directly. PostgreSQL does not check EXECUTE privilege when a
--    trigger fires, so removing the grant does not affect the triggers — it
--    only removes the endpoint.
--
-- 3. Mutable search_path (Supabase linter 0011).
--    Seven functions had no `search_path` pinned. A function that resolves
--    unqualified names against a caller-controlled path can be tricked into
--    calling an attacker's object of the same name. Pinned to `public, pg_temp`.
--
-- Deliberately unchanged
-- ----------------------
-- `get_public_item(uuid)` keeps its `anon` grant. That is the QR-code page a
-- customer opens without an account, and it is meant to be public.
--
-- Reversing this
-- --------------
-- `grant execute on function public.<name>(<args>) to anon;` restores any
-- single grant. Nothing here drops or replaces a function.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Called by the app while signed in: keep `authenticated`, drop `anon`.
--    Each of these already verifies auth.uid() internally; this makes the
--    endpoint itself unreachable to anonymous callers as well.
-- ---------------------------------------------------------------------------
revoke execute on function public.record_asset_event(
  bigint, text, text, text, text, text, text
) from anon;

revoke execute on function public.record_stock_movement(
  bigint, text, integer, text
) from anon;

revoke execute on function public.transfer_inventory_item_to_depot(
  bigint, bigint, text, text
) from anon;

revoke execute on function public.get_asset_assignee_suggestions(text) from anon;

revoke execute on function public.complete_pick_list(bigint, boolean) from anon;

revoke execute on function public.receive_purchase_order(bigint) from anon;

-- ---------------------------------------------------------------------------
-- 2. Internal only — trigger bodies and helpers the app never calls by name.
--    Revoked from both roles. Triggers keep firing: PostgreSQL does not test
--    EXECUTE privilege on a trigger function when the trigger runs.
-- ---------------------------------------------------------------------------

-- The one with no authentication check of its own (finding 1).
revoke execute on function public.recompute_purchase_order_payment(bigint)
  from anon, authenticated;

revoke execute on function public.on_purchase_order_payment_change()
  from anon, authenticated;
revoke execute on function public.clear_deleted_category_from_inventory()
  from anon, authenticated;
revoke execute on function public.sync_category_name_to_inventory()
  from anon, authenticated;
revoke execute on function public.enforce_plan_item_limit()
  from anon, authenticated;
revoke execute on function public.ensure_inventory_depot_owner()
  from anon, authenticated;
revoke execute on function public.guard_pick_list_item_delete()
  from anon, authenticated;
revoke execute on function public.guard_purchase_order_line_delete()
  from anon, authenticated;
revoke execute on function public.normalize_and_validate_pick_list_item()
  from anon, authenticated;
revoke execute on function public.normalize_and_validate_purchase_order_line()
  from anon, authenticated;
revoke execute on function public.normalize_category_fields()
  from anon, authenticated;
revoke execute on function public.normalize_pick_list()
  from anon, authenticated;
revoke execute on function public.normalize_purchase_order()
  from anon, authenticated;
revoke execute on function public.prevent_active_pick_list_inventory_delete()
  from anon, authenticated;
revoke execute on function public.set_suppliers_updated_at()
  from anon, authenticated;
revoke execute on function public.set_updated_at()
  from anon, authenticated;
revoke execute on function public.sync_asset_tracked_quantity()
  from anon, authenticated;
revoke execute on function public.update_quantity_on_asset_event()
  from anon, authenticated;
revoke execute on function public.validate_inventory_category_owner()
  from anon, authenticated;
revoke execute on function public.validate_inventory_supplier_owner()
  from anon, authenticated;
revoke execute on function public.validate_purchase_order_payment()
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pin the schema search path on the seven functions that had none.
--    `pg_temp` is listed last so a temporary object can never shadow a real
--    one, which is the attack this setting exists to stop.
-- ---------------------------------------------------------------------------
alter function public.set_updated_at()
  set search_path = public, pg_temp;
alter function public.ensure_inventory_depot_owner()
  set search_path = public, pg_temp;
alter function public.sync_asset_tracked_quantity()
  set search_path = public, pg_temp;
alter function public.update_quantity_on_asset_event()
  set search_path = public, pg_temp;
alter function public.record_asset_event(
  bigint, text, text, text, text, text, text
) set search_path = public, pg_temp;
alter function public.get_asset_assignee_suggestions(text)
  set search_path = public, pg_temp;
alter function public.transfer_inventory_item_to_depot(
  bigint, bigint, text, text
) set search_path = public, pg_temp;

commit;

-- ===========================================================================
-- Verification — run this after the migration.
--
-- Expected result: exactly ONE row, `get_public_item`, which is public on
-- purpose. Any other row means something is still reachable anonymously.
-- ===========================================================================
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by p.proname;

-- And this should return no rows: every function now has a pinned search_path.
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proconfig is null
order by p.proname;
