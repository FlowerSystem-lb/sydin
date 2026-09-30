-- SydIN Phase 35 TEST -- runs phase-35 inside a transaction, checks the
-- two-step rule on real accounts, then CANCELS itself. Nothing is kept.
-- Expected result: an error that starts with "PHASE 35 TEST PASSED".

begin;

create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1
          from auth.mfa_factors f
         where f.user_id = (select auth.uid())
           and f.status = 'verified'
      );
$$;
revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

do $$
declare
  t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "Two-step verification when on" on public.%I', t.relname);
    execute format(
      'create policy "Two-step verification when on" on public.%I as restrictive for all to authenticated using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t.relname
    );
  end loop;
end $$;

drop policy if exists "Two-step verification when on" on storage.objects;
create policy "Two-step verification when on" on storage.objects
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied()))
  with check ((select public.mfa_satisfied()));

alter table public.billing_notifications add column if not exists detail text null;
alter table public.billing_notifications
  drop constraint if exists billing_notifications_kind_check,
  add constraint billing_notifications_kind_check check (
    kind in ('renew_7d', 'grace_start', 'ended', 'receipt', 'test', 'low_stock', 'weekly_summary')
  );
drop index if exists public.billing_notifications_once;
create unique index billing_notifications_once
  on public.billing_notifications (user_id, kind, coalesce(period_end, 'epoch'::timestamptz))
  where kind in ('renew_7d', 'grace_start', 'ended', 'low_stock', 'weekly_summary');

do $$
declare
  v_protected uuid;   -- an account with two-step on
  v_plain uuid;       -- an account without it
  v_tables int;
  v_no_code int;
  v_with_code int;
  v_plain_rows int;
begin
  select f.user_id into v_protected from auth.mfa_factors f where f.status = 'verified' limit 1;
  select bs.user_id into v_plain from public.business_settings bs
   where not exists (select 1 from auth.mfa_factors f where f.user_id = bs.user_id and f.status = 'verified')
   limit 1;
  if v_protected is null or v_plain is null then
    raise exception 'Need one account with and one without two-step to test';
  end if;

  select count(*) into v_tables from pg_policies where policyname = 'Two-step verification when on';

  -- protected account, session WITHOUT the code
  perform set_config('request.jwt.claims', json_build_object('sub', v_protected, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_no_code from public.business_settings where user_id = v_protected;
  execute 'reset role';

  -- protected account, session WITH the code
  perform set_config('request.jwt.claims', json_build_object('sub', v_protected, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_with_code from public.business_settings where user_id = v_protected;
  execute 'reset role';

  -- account without two-step, normal session
  perform set_config('request.jwt.claims', json_build_object('sub', v_plain, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into v_plain_rows from public.business_settings where user_id = v_plain;
  execute 'reset role';

  if v_no_code <> 0 then raise exception 'FAILED: protected account data visible without the code'; end if;
  if v_with_code <> 1 then raise exception 'FAILED: protected account data hidden even with the code (%)', v_with_code; end if;
  if v_plain_rows <> 1 then raise exception 'FAILED: account without two-step lost access (%)', v_plain_rows; end if;

  raise exception 'PHASE 35 TEST PASSED: rule on % tables; with two-step on, data needs the code; accounts without it are unaffected. Nothing was saved -- now run phase-35-two-step-notifications.sql.', v_tables;
end $$;

rollback;
