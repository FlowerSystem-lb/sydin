-- SydIN Phase 24: Company profile for documents
--
-- An invoice or purchase order that leaves the business should carry the
-- business: where it is, how to reach it, its tax or registration number, a
-- line of payment terms and a footer. business_settings held the name, logo
-- and contact details; this adds the rest. Currency was already a column but
-- Settings never let anyone change it -- that is fixed in the app, not here.
--
-- Run manually in the Supabase SQL editor after reviewing. Safe to re-run.

begin;

alter table public.business_settings
  add column if not exists business_address text null,
  add column if not exists tax_id text null,
  add column if not exists payment_terms text null,
  add column if not exists document_footer text null;

comment on column public.business_settings.business_address is
  'Postal address printed on documents. Line breaks are kept.';
comment on column public.business_settings.tax_id is
  'VAT / tax / commercial registration number printed under the address.';
comment on column public.business_settings.payment_terms is
  'Default payment terms printed on invoices, e.g. "Due within 14 days".';
comment on column public.business_settings.document_footer is
  'Footer line printed on every document, e.g. bank details or a thank-you.';

notify pgrst, 'reload schema';

commit;
