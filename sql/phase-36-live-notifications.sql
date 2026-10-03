-- Phase 36: live bell (3 Oct 2026).
-- Lets the app hear new notifications and stock changes the moment they
-- happen, without reloading. Supabase Realtime only sends a row to a browser
-- whose login may read it under the table's existing security rules (RLS),
-- so no business ever hears another business's changes.
-- Safe to run twice.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventory'
  ) then
    alter publication supabase_realtime add table public.inventory;
  end if;
end $$;

-- Check: should list notifications and inventory.
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;

-- Rollback (only if ever needed):
-- alter publication supabase_realtime drop table public.notifications;
-- alter publication supabase_realtime drop table public.inventory;
