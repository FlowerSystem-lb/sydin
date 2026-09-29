-- SydIN Phase 31: your own lists -- units and payment methods
--
-- 1. business_settings.custom_units: units this business uses beyond the
--    built-in ones (Carton, Roll, Bag...). Picking one on an item stores it the
--    way a custom unit is already stored (unit_type 'custom' + the label), so
--    nothing about items changes.
-- 2. business_settings.payment_methods: the methods offered when recording a
--    payment, in order. Built-in keys (cash, card, transfer, cheque, whish,
--    omt, other) or the business's own words ("Wish Money", "USDT").
-- 3. Payment method columns accept any short text instead of only
--    cash/card/transfer/other, so Whish, OMT, cheque and custom methods can be
--    recorded. Every existing value is still valid.
--
-- Additive and backward compatible. Run in Supabase > SQL Editor after
-- sql/phase-31-lists-TEST.sql passes.

begin;

alter table public.business_settings
  add column if not exists custom_units text[] not null default '{}',
  add column if not exists payment_methods text[] not null
    default array['cash', 'card', 'transfer', 'whish', 'omt', 'cheque'];

alter table public.business_settings
  drop constraint if exists business_settings_lists_check,
  add constraint business_settings_lists_check check (
    cardinality(custom_units) <= 30
    and cardinality(payment_methods) between 1 and 20
  );

-- Payment methods: any short text (was cash/card/transfer/other only).
alter table public.sales_order_payments
  drop constraint if exists sales_order_payments_method_valid,
  add constraint sales_order_payments_method_valid check (
    method is null or char_length(btrim(method)) between 1 and 40
  );

alter table public.purchase_order_payments
  drop constraint if exists purchase_order_payments_method_valid,
  add constraint purchase_order_payments_method_valid check (
    method is null or char_length(btrim(method)) between 1 and 40
  );

alter table public.purchase_orders
  drop constraint if exists purchase_orders_payment_method_valid,
  add constraint purchase_orders_payment_method_valid check (
    payment_method is null or char_length(btrim(payment_method)) between 1 and 40
  );

commit;

-- ============================================================== ROLLBACK
-- (Only safe while no payment uses a method outside cash/card/transfer/other.)
-- begin;
-- alter table public.sales_order_payments drop constraint if exists sales_order_payments_method_valid,
--   add constraint sales_order_payments_method_valid check (method is null or method = any (array['cash','card','transfer','other']));
-- alter table public.purchase_order_payments drop constraint if exists purchase_order_payments_method_valid,
--   add constraint purchase_order_payments_method_valid check (method is null or method = any (array['cash','card','transfer','other']));
-- alter table public.purchase_orders drop constraint if exists purchase_orders_payment_method_valid,
--   add constraint purchase_orders_payment_method_valid check (payment_method is null or payment_method = any (array['cash','card','transfer','other']));
-- alter table public.business_settings drop constraint if exists business_settings_lists_check,
--   drop column if exists custom_units, drop column if exists payment_methods;
-- commit;
