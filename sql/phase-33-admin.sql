-- SydIN Phase 33: the admin console -- customers, cancel, notes, audit log
--
-- 1. user_subscriptions.cancel_at_period_end: "stop renewal" -- the plan runs
--    to its paid end and no reminders are sent (part 3).
-- 2. admin_customer_notes: Sayed's private notes on a customer.
-- 3. admin_audit_log: every admin action -- who, what, on whom, when.
--    Both tables: RLS on, NO policies, so only the server (service role)
--    can read or write them. No customer can ever see them.
-- 4. admin_customer_overview(): one row per SydIN account (plan, status,
--    paid until, last payment, items, team) for the Customers screen.
--    Service role only.
--
-- Additive: nothing existing changes. Run in Supabase > SQL Editor after
-- sql/phase-33-admin-TEST.sql passes.

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
create index if not exists admin_customer_notes_user_idx on public.admin_customer_notes (user_id, created_at desc);
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
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_user, created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

create or replace function public.admin_customer_overview()
returns table (
  user_id uuid,
  email text,
  signed_up timestamptz,
  last_sign_in timestamptz,
  business_name text,
  phone text,
  plan text,
  status text,
  paid_until timestamptz,
  billing_cycle text,
  cancel_at_period_end boolean,
  effective_plan text,
  last_paid_at timestamptz,
  total_paid numeric,
  items bigint,
  members bigint,
  is_team_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    bs.business_name,
    bs.contact_phone,
    coalesce(lower(btrim(us.plan)), 'free'),
    coalesce(lower(btrim(us.status)), 'active'),
    us.paid_until,
    us.billing_cycle,
    coalesce(us.cancel_at_period_end, false),
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

commit;

-- ============================================================== ROLLBACK
-- begin;
-- drop function if exists public.admin_customer_overview();
-- drop table if exists public.admin_audit_log;
-- drop table if exists public.admin_customer_notes;
-- alter table public.user_subscriptions drop column if exists cancel_at_period_end, drop column if exists cancelled_at;
-- commit;
