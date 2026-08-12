-- SydIN Phase 13: Notification Center (light v1 -> persisted)
-- Run manually in the Supabase SQL editor after reviewing.
--
-- Backlog §6 (Notification Center). Scoped deliberately: only "low_stock" and
-- "out_of_stock" are generated today, because those are the only categories
-- in the backlog's list (Inventory / Billing / AI / System / Updates / Team /
-- Low stock / Stock movement / Product announcements) with a real trigger
-- already in the app. Billing needs a payment webhook, AI needs the
-- Assistant, Team needs multi-user, Product announcements need an authoring
-- surface -- none of that exists yet, so this does not fabricate rows for
-- them. See docs/SYDIN_DECISION_LOG.md, 2026-08-12 entry.

begin;

create table if not exists public.notifications (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type = any (array['low_stock'::text, 'out_of_stock'::text])),
  title text not null,
  body text,
  item_id bigint null references public.inventory(id) on delete set null,
  link_href text null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread
  on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

comment on table public.notifications is 'Persisted notification center rows. Generated client-side by recordStockMovement() when an item crosses into low/out of stock -- see app/lib/notifications.ts.';
comment on column public.notifications.type is 'low_stock or out_of_stock only today -- see file header for why the other backlog categories are not generated yet.';
comment on column public.notifications.link_href is 'Where clicking the notification navigates, e.g. /dashboard/inventory/123.';

commit;
