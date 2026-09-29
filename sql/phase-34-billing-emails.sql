-- SydIN Phase 34: automatic billing emails -- remember what was sent
--
-- The daily job (app/api/cron/billing) emails each paying business:
--   renew_7d     7 days before the paid period ends
--   grace_start  on the end day: "you have 3 days to pay"
--   ended        after the 3-day grace: "you're on Free limits, data safe"
-- One row per (account, kind, period end). The unique key is what makes it
-- impossible to send the same reminder twice for the same period, even if
-- the job runs twice. Server-only: RLS on, no policies.
--
-- Additive. Run in Supabase > SQL Editor after the TEST passes.

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

create index if not exists billing_notifications_sent_idx
  on public.billing_notifications (sent_at desc);

alter table public.billing_notifications enable row level security;
revoke all on public.billing_notifications from anon, authenticated;

commit;

-- ROLLBACK: drop table if exists public.billing_notifications;
