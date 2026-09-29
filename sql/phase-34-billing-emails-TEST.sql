-- SydIN Phase 34 TEST -- creates the table inside a transaction, checks the
-- "never twice" rule, then CANCELS itself. Nothing is kept. Expected result:
-- an error that starts with "PHASE 34 TEST PASSED".

begin;

create table if not exists public.billing_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('renew_7d', 'grace_start', 'ended', 'receipt', 'test')),
  period_end timestamptz null,
  email text null,
  sent_at timestamptz not null default now()
);

create unique index if not exists billing_notifications_once
  on public.billing_notifications (user_id, kind, coalesce(period_end, 'epoch'::timestamptz))
  where kind in ('renew_7d', 'grace_start', 'ended');

alter table public.billing_notifications enable row level security;
revoke all on public.billing_notifications from anon, authenticated;

do $$
declare
  v_user uuid;
  v_end timestamptz := now() + interval '7 days';
  v_second int;
begin
  select id into v_user from auth.users limit 1;
  if v_user is null then raise exception 'No account to test with'; end if;

  insert into public.billing_notifications (user_id, kind, period_end) values (v_user, 'renew_7d', v_end);
  insert into public.billing_notifications (user_id, kind, period_end) values (v_user, 'renew_7d', v_end)
    on conflict do nothing;
  get diagnostics v_second = row_count;
  if v_second <> 0 then
    raise exception 'The same reminder was stored twice';
  end if;

  -- receipts are not limited (one per payment)
  insert into public.billing_notifications (user_id, kind) values (v_user, 'receipt');
  insert into public.billing_notifications (user_id, kind) values (v_user, 'receipt');

  if has_table_privilege('authenticated', 'public.billing_notifications', 'select') then
    raise exception 'Signed-in users must not read billing_notifications';
  end if;

  raise exception 'PHASE 34 TEST PASSED: a reminder can only be sent once per period; receipts are unlimited; the table is server-only. Nothing was saved -- now run phase-34-billing-emails.sql.';
end $$;

rollback;
