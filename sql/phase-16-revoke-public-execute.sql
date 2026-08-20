-- ===========================================================================
-- Phase 16 — revoke EXECUTE from PUBLIC (corrects Phase 15)
-- ===========================================================================
-- WHY THIS EXISTS
-- ---------------
-- Phase 15 revoked EXECUTE from `anon` and `authenticated` on 27 functions.
-- Those statements all succeeded, and the search_path half of that migration
-- worked correctly. But the verification query still listed every function as
-- callable by `anon`, because the revokes did not address how `anon` actually
-- held the privilege.
--
-- PostgreSQL grants EXECUTE on a new function to the special role PUBLIC by
-- default. PUBLIC is every role, implicitly. Revoking from a named role while
-- PUBLIC still holds the privilege changes nothing — the named role simply
-- keeps inheriting it. In the ACL this shows as an entry with an empty
-- grantee:
--
--     =X/postgres            <- PUBLIC has EXECUTE
--     authenticated=X/postgres
--
-- So the correct target was PUBLIC all along. This file does that, in one
-- statement instead of twenty-seven.
--
-- WHY THIS IS SAFE
-- ----------------
-- Checked against the live ACLs before writing this. Every function the app
-- actually calls already holds its own explicit grant, which survives the
-- revoke below:
--
--   complete_pick_list                 authenticated=X   (PUBLIC already gone)
--   receive_purchase_order             authenticated=X   (PUBLIC already gone)
--   record_stock_movement              authenticated=X   (PUBLIC already gone)
--   record_asset_event                 authenticated=X
--   transfer_inventory_item_to_depot   authenticated=X
--   get_asset_assignee_suggestions     authenticated=X
--   get_public_item                    anon=X, authenticated=X
--
-- `get_public_item` is the QR page a customer opens without an account. Its
-- `anon` grant is explicit, so it keeps working after PUBLIC is removed.
--
-- Trigger functions need no grant at all: PostgreSQL does not check EXECUTE
-- privilege on a trigger function when the trigger fires.
--
-- REVERSING THIS
-- --------------
--   grant execute on function public.<name>(<args>) to authenticated;
-- restores any single function. Nothing here is dropped or replaced.
-- ===========================================================================

begin;

-- The whole correction, in one line.
revoke execute on all functions in schema public from public;

-- Belt and braces: any function added later would otherwise default to PUBLIC
-- again and quietly reopen this hole. This makes the safe default the default.
alter default privileges in schema public
  revoke execute on functions from public;

commit;

-- ===========================================================================
-- Verification — run these two after the migration.
-- ===========================================================================

-- 1. Expected: exactly ONE row, `get_public_item`.
--    Anything else here is reachable by a stranger on the internet.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by p.proname;

-- 2. Expected: exactly these six, and nothing missing from them.
--    This is the check that the app still works — if one of the functions the
--    app calls is absent here, signed-in users would get a permission error.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
order by p.proname;
