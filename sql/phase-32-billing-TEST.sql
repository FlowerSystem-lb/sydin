-- SydIN Phase 32 TEST -- runs the whole of phase-32-billing.sql inside a
-- transaction, tries the payment + grace rules on one real account, then
-- CANCELS itself (the final raise exception rolls everything back). Nothing
-- is kept. Expected result: an error that starts with "PHASE 32 TEST PASSED".

begin;


alter table public.user_subscriptions
  add column if not exists paid_until timestamptz null,
  add column if not exists billing_cycle text null;

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_billing_cycle_check,
  add constraint user_subscriptions_billing_cycle_check check (
    billing_cycle is null or billing_cycle in ('monthly', 'yearly')
  );

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
    when us.paid_until is not null and now() > us.paid_until + interval '3 days' then 'free'
    when lower(btrim(us.plan)) in ('standard', 'pro') then lower(btrim(us.plan))
    else 'free'
  end
  from (select 1) one
  left join public.user_subscriptions us on us.user_id = p_owner;
$$;

create or replace function public.record_subscription_payment(
  p_user uuid, p_plan text, p_cycle text, p_months integer, p_amount numeric,
  p_currency text, p_method text, p_reference text, p_note text, p_recorded_by uuid
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

do $$
declare
  v_user uuid;
  v_before int;
  v_after int;
  v_row public.subscription_payments;
  v_until timestamptz;
  v_plan text;
  v_user_can_write boolean;
begin
  -- every existing subscription keeps its plan (paid_until is null today)
  select count(*) into v_before from public.user_subscriptions
   where lower(btrim(coalesce(status, ''))) = 'active' and lower(btrim(plan)) in ('standard', 'pro');
  select count(*) into v_after from public.user_subscriptions
   where public.effective_plan(user_id) in ('standard', 'pro');
  if v_before <> v_after then
    raise exception 'Existing plans changed: % before, % after', v_before, v_after;
  end if;

  -- pick one real account to try the rules on (all undone at the end)
  select user_id into v_user from public.business_settings order by user_id limit 1;
  if v_user is null then
    select user_id into v_user from public.user_subscriptions limit 1;
  end if;
  if v_user is null then raise exception 'No account to test with'; end if;

  -- A. first payment: 1 month of Standard starting now
  delete from public.user_subscriptions where user_id = v_user;
  v_row := public.record_subscription_payment(v_user, 'standard', 'monthly', 1, 9, 'usd', 'whish', 'REF1', null, null);
  select paid_until, public.effective_plan(v_user) into v_until, v_plan from public.user_subscriptions where user_id = v_user;
  if v_plan <> 'standard' or abs(extract(epoch from (v_until - (now() + interval '1 month')))) > 60 then
    raise exception 'A failed: plan %, until %', v_plan, v_until;
  end if;

  -- B. 2 days after the end: still Standard (grace)
  update public.user_subscriptions set paid_until = now() - interval '2 days' where user_id = v_user;
  if public.effective_plan(v_user) <> 'standard' then raise exception 'B failed: grace not applied'; end if;

  -- C. paying inside the grace continues from the old end (no free days)
  v_row := public.record_subscription_payment(v_user, 'standard', 'monthly', 1, 9, 'USD', 'omt', null, null, null);
  if abs(extract(epoch from (v_row.period_start - (now() - interval '2 days')))) > 60 then
    raise exception 'C failed: period started %', v_row.period_start;
  end if;

  -- D. 4 days after the end: back to Free limits -- data untouched
  update public.user_subscriptions set paid_until = now() - interval '4 days' where user_id = v_user;
  if public.effective_plan(v_user) <> 'free' then raise exception 'D failed: expired plan still active'; end if;

  -- E. paying after expiry starts a fresh period now
  v_row := public.record_subscription_payment(v_user, 'pro', 'yearly', 12, 190, 'USD', 'cash', null, null, null);
  if abs(extract(epoch from (v_row.period_start - now()))) > 60 or public.effective_plan(v_user) <> 'pro' then
    raise exception 'E failed';
  end if;

  -- F. two payments in the history for this account (A, C, E = 3)
  if (select count(*) from public.subscription_payments where user_id = v_user) <> 3 then
    raise exception 'F failed: history count';
  end if;

  -- G. signed-in users cannot change their own subscription row (their only
  --    insert rule is for a free row, which is safe)
  select exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'user_subscriptions'
       and cmd in ('UPDATE', 'ALL')
  ) into v_user_can_write;
  if v_user_can_write then
    raise exception 'G: user_subscriptions has a write policy -- review before going live';
  end if;

  raise exception 'PHASE 32 TEST PASSED: % paid plans unchanged; first payment, 3-day grace, paying late, expiry to Free, and fresh restart all behave. Nothing was saved -- now run phase-32-billing.sql.', v_before;
end $$;

rollback;
