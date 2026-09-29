-- SydIN Phase 33 TEST -- runs phase-33-admin.sql inside a transaction,
-- checks it, then CANCELS itself. Nothing is kept. Expected result: an error
-- that starts with "PHASE 33 TEST PASSED".

begin;

alter table public.user_subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz null;

create table if not exists public.admin_customer_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  admin_id uuid null references auth.users (id) on delete set null,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.admin_customer_notes enable row level security;
revoke all on public.admin_customer_notes from anon, authenticated;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid null references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 60),
  target_user uuid null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

create or replace function public.admin_customer_overview()
returns table (
  user_id uuid, email text, signed_up timestamptz, last_sign_in timestamptz,
  business_name text, phone text, plan text, status text, paid_until timestamptz,
  billing_cycle text, cancel_at_period_end boolean, effective_plan text,
  last_paid_at timestamptz, total_paid numeric, items bigint, members bigint,
  is_team_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id, u.email::text, u.created_at, u.last_sign_in_at, bs.business_name, bs.contact_phone,
    coalesce(lower(btrim(us.plan)), 'free'), coalesce(lower(btrim(us.status)), 'active'),
    us.paid_until, us.billing_cycle, coalesce(us.cancel_at_period_end, false),
    public.effective_plan(u.id),
    (select max(p.paid_at) from public.subscription_payments p where p.user_id = u.id),
    (select coalesce(sum(p.amount), 0) from public.subscription_payments p where p.user_id = u.id),
    (select count(*) from public.inventory i where i.user_id = u.id),
    (select count(*) from public.business_members m where m.owner_id = u.id and m.status = 'active'),
    exists (select 1 from public.business_members m where m.member_id = u.id and m.status = 'active')
  from auth.users u
  left join public.business_settings bs on bs.user_id = u.id
  left join public.user_subscriptions us on us.user_id = u.id
  order by u.created_at desc;
$$;
revoke all on function public.admin_customer_overview() from public, anon, authenticated;
grant execute on function public.admin_customer_overview() to service_role;

do $$
declare
  v_users int;
  v_rows int;
  v_paid int;
  v_policies int;
begin
  select count(*) into v_users from auth.users;
  select count(*) into v_rows from public.admin_customer_overview();
  if v_rows <> v_users then
    raise exception 'Overview should list every account (% of %)', v_rows, v_users;
  end if;

  select count(*) into v_paid from public.admin_customer_overview() where effective_plan in ('standard', 'pro');

  select count(*) into v_policies from pg_policies
   where schemaname = 'public' and tablename in ('admin_customer_notes', 'admin_audit_log');
  if v_policies <> 0 then
    raise exception 'Admin tables must have no policies (found %)', v_policies;
  end if;

  if has_function_privilege('authenticated', 'public.admin_customer_overview()', 'execute') then
    raise exception 'Signed-in users must not be able to run the overview';
  end if;
  if has_table_privilege('authenticated', 'public.admin_audit_log', 'select') then
    raise exception 'Signed-in users must not read the audit log';
  end if;

  raise exception 'PHASE 33 TEST PASSED: % accounts listed (% on a paid plan); notes and audit log are server-only. Nothing was saved -- now run phase-33-admin.sql.', v_rows, v_paid;
end $$;

rollback;
