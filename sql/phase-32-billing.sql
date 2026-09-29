-- SydIN Phase 32: paid periods, 3-day grace, and payment history
--
-- How it works (manual payments, 29 Sep 2026):
--   * A customer pays by Whish / OMT / crypto and tells Sayed on WhatsApp.
--   * Sayed records the payment in /admin. record_subscription_payment()
--     writes the payment to the history and moves paid_until forward by the
--     months paid -- access is on straight away.
--   * When paid_until passes, the customer has 3 more days (grace) with full
--     access and a "please pay" notice.
--   * After the grace, the account falls back to the FREE plan's limits.
--     NOTHING is deleted: every item, invoice and customer stays, readable
--     and exportable. Paying again restores the plan instantly.
--
-- 1. user_subscriptions: paid_until (null = no end date: Free, or a plan
--    given without a period -- every account before this file) and
--    billing_cycle.
-- 2. subscription_payments: the history the customer sees in Plan & billing.
--    Only the server (service role) writes it; the owner can read it.
-- 3. effective_plan(owner): the ONE definition of "which plan applies now",
--    used by the item / pick-list / team-seat limits. Mirrored in
--    app/lib/subscription.ts (getUserSubscription).
-- 4. record_subscription_payment(...): server-only; records a payment and
--    extends the period in one step.
--
-- Backward compatible: paid_until is null for everyone today, so every
-- current plan keeps working exactly as before.
-- Run in Supabase > SQL Editor after sql/phase-32-billing-TEST.sql passes.

begin;

-- ------------------------------------------------------------ 1. periods
alter table public.user_subscriptions
  add column if not exists paid_until timestamptz null,
  add column if not exists billing_cycle text null;

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_billing_cycle_check,
  add constraint user_subscriptions_billing_cycle_check check (
    billing_cycle is null or billing_cycle in ('monthly', 'yearly')
  );

-- ------------------------------------------------------------ 2. history
create table if not exists public.subscription_payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('standard', 'pro')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  months integer not null check (months between 1 and 24),
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  method text null check (method is null or char_length(btrim(method)) between 1 and 40),
  reference text null check (reference is null or char_length(reference) <= 120),
  note text null check (note is null or char_length(note) <= 500),
  period_start timestamptz not null,
  period_end timestamptz not null,
  paid_at timestamptz not null default now(),
  recorded_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint subscription_payments_period_check check (period_end > period_start)
);

create index if not exists subscription_payments_user_paid_idx
  on public.subscription_payments (user_id, paid_at desc);

alter table public.subscription_payments enable row level security;

drop policy if exists "Owner reads own subscription payments" on public.subscription_payments;
create policy "Owner reads own subscription payments"
  on public.subscription_payments
  for select
  to authenticated
  using (
    user_id = (select public.current_business_id())
    and (select public.current_business_role()) = 'owner'
  );
-- No insert / update / delete policy: only the server writes payments.
revoke all on public.subscription_payments from anon;
revoke insert, update, delete on public.subscription_payments from authenticated;
grant select on public.subscription_payments to authenticated;

-- ------------------------------------------------------------ 3. the rule
create or replace function public.effective_plan(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when us.user_id is null then 'free'
    when lower(btrim(coalesce(us.status, ''))) <> 'active' then 'free'
    -- 3 days of grace after the paid period ends
    when us.paid_until is not null and now() > us.paid_until + interval '3 days' then 'free'
    when lower(btrim(us.plan)) in ('standard', 'pro') then lower(btrim(us.plan))
    else 'free'
  end
  from (select 1) one
  left join public.user_subscriptions us on us.user_id = p_owner;
$$;

create or replace function public.team_seat_limit(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case public.effective_plan(p_owner)
    when 'pro' then 10
    when 'standard' then 3
    else 1
  end;
$$;

create or replace function public.enforce_plan_item_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  current_plan text;
  plan_limit integer;
  used_items integer;
begin
  -- Same ownership guard as before (sql/phase-7 / phase-28).
  if public.current_business_id() is null or new.user_id <> public.current_business_id() then
    raise exception 'Inventory item must belong to the authenticated user.'
      using errcode = '42501';
  end if;

  -- Phase 32: one rule for "which plan applies now", including the 3-day
  -- grace after a paid period (mirrors getUserSubscription in the app).
  current_plan := public.effective_plan(new.user_id);

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
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_pick_list_active_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  effective_plan text;
  active_limit integer;
  active_count integer;
begin
  if public.current_business_id() is null or new.user_id <> public.current_business_id() then
    raise exception 'Pick list must belong to the authenticated user.'
      using errcode = '42501';
  end if;

  effective_plan := public.effective_plan(new.user_id);

  if effective_plan = 'pro' then
    return new;
  end if;

  active_limit := case
    when effective_plan = 'standard' then 50
    else 3
  end;

  select count(*)
  into active_count
  from public.pick_lists pl
  where pl.user_id = new.user_id
    and pl.status in ('draft', 'preparing');

  if active_count >= active_limit then
    raise exception 'Active Pick List limit reached for the current plan.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

-- ------------------------------------------------------------ 4. recording
create or replace function public.record_subscription_payment(
  p_user uuid,
  p_plan text,
  p_cycle text,
  p_months integer,
  p_amount numeric,
  p_currency text,
  p_method text,
  p_reference text,
  p_note text,
  p_recorded_by uuid
)
returns public.subscription_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.user_subscriptions;
  v_start timestamptz;
  v_end timestamptz;
  v_row public.subscription_payments;
begin
  if p_plan not in ('standard', 'pro') then
    raise exception 'Unknown plan %', p_plan using errcode = '22023';
  end if;
  if p_cycle not in ('monthly', 'yearly') then
    raise exception 'Unknown billing cycle %', p_cycle using errcode = '22023';
  end if;
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'Months must be between 1 and 24' using errcode = '22023';
  end if;

  select * into v_sub from public.user_subscriptions where user_id = p_user for update;

  -- Same plan, still paid or inside the grace: the new period continues from
  -- where the old one ends (paying late never gives free days). Otherwise --
  -- a first payment, a plan change, or long expired -- it starts now.
  if v_sub.user_id is not null
     and lower(btrim(coalesce(v_sub.plan, ''))) = p_plan
     and lower(btrim(coalesce(v_sub.status, ''))) = 'active'
     and v_sub.paid_until is not null
     and v_sub.paid_until + interval '3 days' >= now() then
    v_start := v_sub.paid_until;
  else
    v_start := now();
  end if;
  v_end := v_start + make_interval(months => p_months);

  insert into public.subscription_payments (
    user_id, plan, billing_cycle, months, amount, currency, method,
    reference, note, period_start, period_end, recorded_by
  ) values (
    p_user, p_plan, p_cycle, p_months, round(coalesce(p_amount, 0), 2),
    upper(coalesce(nullif(btrim(p_currency), ''), 'USD')),
    nullif(btrim(coalesce(p_method, '')), ''),
    nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_start, v_end, p_recorded_by
  )
  returning * into v_row;

  insert into public.user_subscriptions (
    user_id, plan, item_limit, status, activated_at, updated_at, paid_until, billing_cycle
  ) values (
    p_user, p_plan, case p_plan when 'pro' then 1000 else 250 end, 'active',
    now(), now(), v_end, p_cycle
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    item_limit = excluded.item_limit,
    status = 'active',
    activated_at = coalesce(public.user_subscriptions.activated_at, now()),
    updated_at = now(),
    paid_until = excluded.paid_until,
    billing_cycle = excluded.billing_cycle;

  return v_row;
end;
$$;

revoke all on function public.record_subscription_payment(uuid, text, text, integer, numeric, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_subscription_payment(uuid, text, text, integer, numeric, text, text, text, text, uuid)
  to service_role;

revoke all on function public.effective_plan(uuid) from public, anon;
grant execute on function public.effective_plan(uuid) to authenticated;

commit;

-- ============================================================== ROLLBACK
-- begin;
-- drop function if exists public.record_subscription_payment(uuid, text, text, integer, numeric, text, text, text, text, uuid);
-- (restore team_seat_limit / enforce_plan_item_limit / enforce_pick_list_active_limit from
--  sql/phase-28-team-access.sql -- they read user_subscriptions.status directly)
-- drop function if exists public.effective_plan(uuid);
-- drop table if exists public.subscription_payments;
-- alter table public.user_subscriptions drop constraint if exists user_subscriptions_billing_cycle_check,
--   drop column if exists paid_until, drop column if exists billing_cycle;
-- commit;
