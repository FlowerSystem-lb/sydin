-- SydIN Phase 35: two-step verification for everyone + email notifications
--
-- 1. Two-step verification that really protects. Anyone can switch on an
--    authenticator app (Settings > My profile). From then on their data is
--    only served to a session that entered the app's code (Supabase "aal2").
--    Done with one RESTRICTIVE policy per table: it never grants access, it
--    only adds "and, if this person has two-step on, the code was entered".
--    People without two-step on are not affected at all.
--    (Supabase's own recipe: "Enforce MFA for users who have opted in".)
-- 2. billing_notifications also records low-stock alerts and the weekly
--    summary, so each goes out once per day / week.
--
-- Run in Supabase > SQL Editor after the TEST passes.

begin;

-- ---------------------------------------------------------------- 1. two-step
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
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
  loop
    execute format('drop policy if exists "Two-step verification when on" on public.%I', t.relname);
    execute format(
      'create policy "Two-step verification when on" on public.%I as restrictive for all to authenticated using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t.relname
    );
  end loop;
end $$;

-- Photos, logos and attachments follow the same rule.
drop policy if exists "Two-step verification when on" on storage.objects;
create policy "Two-step verification when on" on storage.objects
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied()))
  with check ((select public.mfa_satisfied()));

-- ---------------------------------------------------------------- 2. notifications
alter table public.billing_notifications
  add column if not exists detail text null;

alter table public.billing_notifications
  drop constraint if exists billing_notifications_kind_check,
  add constraint billing_notifications_kind_check check (
    kind in ('renew_7d', 'grace_start', 'ended', 'receipt', 'test', 'low_stock', 'weekly_summary')
  );

drop index if exists public.billing_notifications_once;
create unique index billing_notifications_once
  on public.billing_notifications (user_id, kind, coalesce(period_end, 'epoch'::timestamptz))
  where kind in ('renew_7d', 'grace_start', 'ended', 'low_stock', 'weekly_summary');

commit;

-- ============================================================== ROLLBACK
-- begin;
-- do $$ declare t record; begin
--   for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--            where n.nspname = 'public' and c.relkind = 'r' loop
--     execute format('drop policy if exists "Two-step verification when on" on public.%I', t.relname);
--   end loop; end $$;
-- drop policy if exists "Two-step verification when on" on storage.objects;
-- drop function if exists public.mfa_satisfied();
-- commit;
