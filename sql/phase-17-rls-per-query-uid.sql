-- ===========================================================================
-- Phase 17 — make the security rules check the user ONCE per query
-- ===========================================================================
-- WHAT THIS FIXES
-- ---------------
-- Every table in SydIN is shared by every customer: your rows and another
-- business's rows live side by side, and a row-level security policy is what
-- keeps them apart. There are 61 such policies. 60 of them are written as:
--
--     auth.uid() = user_id
--
-- PostgreSQL treats `auth.uid()` there as something it must work out again for
-- every row it looks at. Reading 500 products means asking "who is signed in?"
-- 500 times, and it gets worse as the table fills with other customers' rows,
-- because the check runs before the rows are filtered out.
--
-- Wrapping the call in a scalar sub-select:
--
--     (select auth.uid()) = user_id
--
-- lets the planner run it once and reuse the answer (an InitPlan). This is
-- Supabase's own documented recommendation for RLS at scale. The permission
-- logic is identical — the same function, the same comparison, the same
-- result. Only the number of times it is evaluated changes.
--
-- WHY IT IS WRITTEN AS A LOOP INSTEAD OF 60 STATEMENTS
-- ----------------------------------------------------
-- Because transcribing 60 security policies by hand is exactly where a typo
-- becomes a data leak. This reads each policy as it is actually deployed,
-- rewrites only the function call, and puts it back. It cannot invent a
-- condition that was not already there, and it cannot drop one.
--
-- It is also safe to run twice: policies already using `(select auth.uid())`
-- are skipped.
--
-- WHAT IT DOES NOT TOUCH
-- ----------------------
-- Nothing in `auth.` or `storage.` — those are Supabase's own schemas.
-- No policy is created or dropped, so no table changes who can read it.
-- The one policy that does not mention auth.uid() is left alone.
--
-- REVERSING THIS
-- --------------
-- Run the same loop with the replace() arguments swapped. Nothing is dropped,
-- so there is nothing to restore.
-- ===========================================================================

begin;

do $$
declare
  r record;
  stmt text;
  n int := 0;
begin
  for r in
    select policyname, tablename, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%auth.uid()%'
      and (coalesce(qual, '') || coalesce(with_check, '')) not like '%select auth.uid()%'
  loop
    stmt := 'alter policy ' || quote_ident(r.policyname)
         || ' on public.' || quote_ident(r.tablename)
         || coalesce(' using ('
              || replace(r.qual, 'auth.uid()', '(select auth.uid())') || ')', '')
         || coalesce(' with check ('
              || replace(r.with_check, 'auth.uid()', '(select auth.uid())') || ')', '');
    execute stmt;
    n := n + 1;
  end loop;
  raise notice 'rewrote % policies', n;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes on the foreign keys that had none.
--
-- Worth saying plainly why these matter, because SydIN's own tables are small
-- today: they are shared by every customer. `inventory` is not 500 rows, it is
-- 500 rows per business. At a hundred businesses it is 50,000, and that is the
-- number these indexes are for.
--
-- Without an index whose FIRST column is the foreign key, deleting a category,
-- a supplier or a depot forces PostgreSQL to scan the whole child table to
-- check nothing still points at it. The existing composite indexes
-- (`inventory_user_category_idx` and friends) do not help there, because
-- user_id leads them.
-- ---------------------------------------------------------------------------
create index if not exists inventory_category_id_idx
  on public.inventory (category_id);
create index if not exists inventory_supplier_id_fk_idx
  on public.inventory (supplier_id);
create index if not exists inventory_assets_item_id_idx
  on public.inventory_assets (inventory_item_id);
create index if not exists inventory_history_item_id_idx
  on public.inventory_history (item_id);
create index if not exists inventory_history_user_id_idx
  on public.inventory_history (user_id);
create index if not exists notifications_item_id_idx
  on public.notifications (item_id);
create index if not exists plan_requests_user_id_idx
  on public.plan_requests (user_id);
create index if not exists plan_requests_reviewed_by_idx
  on public.plan_requests (reviewed_by);
create index if not exists purchase_orders_depot_id_fk_idx
  on public.purchase_orders (depot_id);
create index if not exists purchase_orders_supplier_id_fk_idx
  on public.purchase_orders (supplier_id);
create index if not exists stock_movements_depot_id_idx
  on public.stock_movements (depot_id);

commit;

-- ===========================================================================
-- Verification — run these three after the migration.
-- ===========================================================================

-- 1. Expected: per_row_uid = 0, wrapped = 60, total = 61.
--    If per_row_uid is not 0, some policy was not rewritten.
select count(*) filter (where q like '%auth.uid()%'
                          and q not like '%select auth.uid()%') as per_row_uid,
       count(*) filter (where q like '%select auth.uid()%')     as wrapped,
       count(*)                                                 as total
from (
  select coalesce(qual, '') || ' ' || coalesce(with_check, '') as q
  from pg_policies where schemaname = 'public'
) s;

-- 2. Expected: 61 rows, the same 61 policy names as before the migration.
--    This is the check that nothing was dropped.
select tablename, policyname, cmd
from pg_policies where schemaname = 'public'
order by tablename, policyname;

-- 3. Expected: no rows for any table in `public`.
--    (auth.* and storage.* rows are Supabase's own and are not ours to fix.)
select c.conrelid::regclass::text as table_name, c.conname as fk
from pg_constraint c
where c.contype = 'f'
  and c.connamespace = 'public'::regnamespace
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid
      and (i.indkey::smallint[])[0:array_length(c.conkey,1)-1] = c.conkey
  )
order by 1, 2;
