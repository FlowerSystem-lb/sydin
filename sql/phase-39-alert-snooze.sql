-- Phase 39: snooze a stock alert (8 Oct 2026, Sayed's Stock alerts redesign).
-- Additive: one nullable column. A snoozed item is left out of Stock alerts
-- and its counts until this time passes; nothing else reads it. Existing RLS
-- on inventory decides who may set it.
alter table public.inventory add column if not exists alert_snoozed_until timestamptz;
