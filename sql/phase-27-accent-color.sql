-- Phase 27: a per-account accent colour for printed documents (brief point 15).
-- Additive only. NULL means "use SydIN's default blue" -- nothing to backfill.

alter table public.business_settings
  add column if not exists accent_color text;

comment on column public.business_settings.accent_color is
  'Hex colour (e.g. #2563EB) for the accent bar on printed documents. NULL = default SydIN blue.';
