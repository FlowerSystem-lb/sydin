-- SydIN Phase 31 TEST -- runs the whole of phase-31-lists.sql inside a
-- transaction, checks it, and then CANCELS itself (the final raise exception
-- rolls everything back). Nothing is kept. Expected result: an error message
-- that starts with "PHASE 31 TEST PASSED".

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

do $$
declare
  v_settings int;
  v_defaults int;
  v_bad_so int;
  v_bad_po int;
  v_ok boolean := false;
begin
  select count(*) into v_settings from public.business_settings;
  select count(*) into v_defaults from public.business_settings
   where custom_units = '{}' and 'whish' = any (payment_methods);
  if v_defaults <> v_settings then
    raise exception 'Every business should get the default lists (% of %)', v_defaults, v_settings;
  end if;

  -- existing values all still valid
  select count(*) into v_bad_so from public.sales_order_payments
   where not (method is null or char_length(btrim(method)) between 1 and 40);
  select count(*) into v_bad_po from public.purchase_orders
   where not (payment_method is null or char_length(btrim(payment_method)) between 1 and 40);
  if v_bad_so + v_bad_po > 0 then
    raise exception 'Existing payment methods would break (%, %)', v_bad_so, v_bad_po;
  end if;

  -- a too-long list is refused
  begin
    update public.business_settings
       set custom_units = array_fill('x'::text, array[31])
     where user_id = (select user_id from public.business_settings limit 1);
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'A 31-unit list should be refused';
  end if;

  raise exception 'PHASE 31 TEST PASSED: % businesses got the default lists; existing payments all valid; limits enforced. Nothing was saved -- now run phase-31-lists.sql.', v_settings;
end $$;

rollback;
