-- ===========================================================================
-- Phase 17b — flatten the nested sub-selects phase-17 created
-- ===========================================================================
-- WHAT WENT WRONG
-- ---------------
-- phase-17 rewrote `auth.uid() = user_id` as `(select auth.uid()) = user_id`
-- so the user is identified once per query instead of once per row. That part
-- worked. Its "safe to run twice" guard did not:
--
--     and (...) not like '%select auth.uid()%'
--
-- PostgreSQL stores the rewritten expression as `( SELECT auth.uid() AS uid)`
-- — upper case, with an alias. LIKE is case-sensitive, so the guard never
-- recognised a policy it had already rewritten, and each re-run wrapped it
-- once more. It ran four times and left:
--
--     (( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) ...) = user_id)
--
-- Permissions were never affected — the value is the same at any depth, and
-- the planner still resolves it once. But it is wrong and it hides the real
-- condition, so it does not stay.
--
-- WHAT THIS DOES
-- --------------
-- Peels the nesting back to plain `auth.uid()`, then wraps exactly once.
-- Applies to every policy mentioning auth.uid() regardless of current depth,
-- so it is a normaliser, not a patch for one specific depth.
--
-- APPLIED 2026-08-27. Verified after: 61 policies total, 60 wrapped exactly
-- once, 0 still nested, 0 left unwrapped. Spot-checked the two most complex
-- policies (pick_list_items update, user_subscriptions insert) to confirm
-- their EXISTS clauses and status/plan conditions survived unchanged.
--
-- LESSON, WORTH KEEPING
-- ---------------------
-- phase-15 failed by revoking from named roles while PUBLIC held the grant.
-- phase-17 failed by comparing deparsed SQL case-sensitively. Both times the
-- statement succeeded and the intent did not. Verify by reading back what the
-- database now says, not by trusting that a migration ran without error.
-- ===========================================================================

do $$
declare
  r record; q text; wc text; stmt text; n int := 0;
begin
  for r in
    select policyname, tablename, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') || coalesce(with_check,'')) ilike '%auth.uid()%'
  loop
    q  := r.qual;
    wc := r.with_check;

    for i in 1..12 loop
      q  := replace(coalesce(q,  ''), '( SELECT auth.uid() AS uid)', 'auth.uid()');
      wc := replace(coalesce(wc, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()');
    end loop;

    q  := replace(q,  'auth.uid()', '(select auth.uid())');
    wc := replace(wc, 'auth.uid()', '(select auth.uid())');

    stmt := 'alter policy ' || quote_ident(r.policyname)
         || ' on public.' || quote_ident(r.tablename)
         || case when r.qual       is not null then ' using ('      || q  || ')' else '' end
         || case when r.with_check is not null then ' with check (' || wc || ')' else '' end;
    execute stmt;
    n := n + 1;
  end loop;
  raise notice 'normalised % policies', n;
end $$;

-- Verification. Expected: total 61, wrapped_once 60, still_nested 0, unwrapped 0.
select count(*)                                                  as total_policies,
       count(*) filter (where q ilike '%select auth.uid() as uid%') as wrapped_once,
       count(*) filter (where q ~* 'SELECT \( SELECT')            as still_nested,
       count(*) filter (where q ilike '%auth.uid()%'
                          and q not ilike '%select auth.uid()%')  as unwrapped
from (select coalesce(qual,'')||' '||coalesce(with_check,'') as q
      from pg_policies where schemaname='public') s;
