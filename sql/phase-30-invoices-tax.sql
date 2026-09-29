-- SydIN Phase 30: Invoices & tax -- own invoice numbering, and VAT
--
-- 1. business_settings gets: invoice prefix / next number / digits, an
--    optional purchase-order prefix, and the tax setup (on/off, name, rate,
--    whether prices already include it).
-- 2. Every invoice (sales_orders) keeps the tax it was made with -- name,
--    rate, inclusive or not -- so changing the rate later never rewrites old
--    invoices. NULL rate = no tax (every invoice before this file).
-- 3. sales_order_total(id): the one definition of an invoice total
--    (lines + tax when tax is added on top). recompute_sales_order_payment now
--    uses it, so "paid" means the customer paid the amount WITH tax.
-- 4. next_invoice_number(p_reserve): the database hands out invoice numbers,
--    locked, so two people never get the same one; staff can use it even
--    though they cannot edit settings. Preview = p_reserve false.
--
-- Additive and backward compatible: with tax off and no prefix set, every
-- total and every number comes out exactly as before.
-- Run in Supabase > SQL Editor after sql/phase-30-invoices-tax-TEST.sql passes.

begin;

-- ---------------------------------------------------------------- 1. settings
alter table public.business_settings
  add column if not exists invoice_prefix text not null default 'INV-',
  add column if not exists invoice_next_number integer null,
  add column if not exists invoice_number_digits smallint not null default 4,
  add column if not exists po_prefix text null,
  add column if not exists tax_enabled boolean not null default false,
  add column if not exists tax_name text not null default 'VAT',
  add column if not exists tax_rate numeric(6, 3) not null default 0,
  add column if not exists prices_include_tax boolean not null default false;

alter table public.business_settings
  drop constraint if exists business_settings_invoice_numbering_check,
  add constraint business_settings_invoice_numbering_check check (
    char_length(invoice_prefix) <= 12
    and (invoice_next_number is null or invoice_next_number between 1 and 99999999)
    and invoice_number_digits between 1 and 8
    and (po_prefix is null or char_length(po_prefix) <= 12)
  ),
  drop constraint if exists business_settings_tax_check,
  add constraint business_settings_tax_check check (
    tax_rate >= 0 and tax_rate <= 100 and char_length(tax_name) between 1 and 20
  );

-- ---------------------------------------------------------------- 2. invoices
alter table public.sales_orders
  add column if not exists tax_name text null,
  add column if not exists tax_rate numeric(6, 3) null,
  add column if not exists prices_include_tax boolean not null default false;

alter table public.sales_orders
  drop constraint if exists sales_orders_tax_check,
  add constraint sales_orders_tax_check check (
    tax_rate is null or (tax_rate >= 0 and tax_rate <= 100)
  );

-- ---------------------------------------------------------------- 3. totals
-- Mirrored in app/lib/salesOrders.ts (getSalesOrderTotals): tax on top is
-- rounded to 2 decimals once, on the whole subtotal.
create or replace function public.sales_order_total(p_order_id bigint)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when o.tax_rate is null or o.tax_rate = 0 or o.prices_include_tax
             then s.subtotal
           else s.subtotal + round(s.subtotal * o.tax_rate / 100, 2)
         end
    from public.sales_orders o
    cross join lateral (
      select coalesce(sum(l.quantity * coalesce(l.unit_price, 0)), 0) as subtotal
        from public.sales_order_lines l
       where l.sales_order_id = o.id
    ) s
   where o.id = p_order_id;
$$;

create or replace function public.recompute_sales_order_payment(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_paid numeric(12, 2);
  v_total numeric(12, 2);
  v_status text;
  v_owner uuid;
  v_order_status text;
begin
  select user_id, status into v_owner, v_order_status
  from public.sales_orders where id = p_order_id;

  if v_owner is null then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.sales_order_payments
  where sales_order_id = p_order_id;

  -- Phase 30: the total includes tax added on top.
  v_total := coalesce(public.sales_order_total(p_order_id), 0);

  if v_paid <= 0 then
    v_status := 'unpaid';
  elsif v_total > 0 and v_paid >= v_total then
    v_status := 'paid';
  else
    v_status := 'partial';
  end if;

  if v_status = 'paid' and v_order_status = 'issued' then
    v_order_status := 'paid';
  elsif v_status <> 'paid' and v_order_status = 'paid' then
    v_order_status := 'issued';
  end if;

  update public.sales_orders
  set amount_paid = v_paid,
      payment_status = v_status,
      status = v_order_status
  where id = p_order_id;
end;
$function$;

-- ---------------------------------------------------------------- 4. numbers
create or replace function public.next_invoice_number(p_reserve boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid := public.current_business_id();
  v_prefix text := 'INV-';
  v_next integer;
  v_digits integer := 4;
  v_has_settings boolean := false;
  v_candidate text;
  v_tries integer := 0;
begin
  if v_business is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_reserve and not public.can_write() then
    raise exception 'Your role can only view this business.' using errcode = '42501';
  end if;

  if p_reserve then
    -- Lock the settings row: numbers are handed out one at a time.
    select coalesce(bs.invoice_prefix, 'INV-'), bs.invoice_next_number, coalesce(bs.invoice_number_digits, 4), true
      into v_prefix, v_next, v_digits, v_has_settings
      from public.business_settings bs
     where bs.user_id = v_business
     for update;
  else
    select coalesce(bs.invoice_prefix, 'INV-'), bs.invoice_next_number, coalesce(bs.invoice_number_digits, 4), true
      into v_prefix, v_next, v_digits, v_has_settings
      from public.business_settings bs
     where bs.user_id = v_business;
  end if;

  v_prefix := coalesce(v_prefix, 'INV-');
  v_digits := coalesce(v_digits, 4);

  if v_next is null then
    -- No starting number chosen: continue after the highest one already used
    -- with this prefix (INV-0006 -> INV-0007).
    select coalesce(max(substring(btrim(so.invoice_number) from char_length(v_prefix) + 1)::bigint), 0) + 1
      into v_next
      from public.sales_orders so
     where so.user_id = v_business
       and left(btrim(so.invoice_number), char_length(v_prefix)) = v_prefix
       and substring(btrim(so.invoice_number) from char_length(v_prefix) + 1) ~ '^[0-9]{1,9}$';
  end if;

  loop
    v_candidate := v_prefix || lpad(v_next::text, v_digits, '0');
    exit when not exists (
      select 1 from public.sales_orders so
       where so.user_id = v_business
         and lower(btrim(so.invoice_number)) = lower(v_candidate)
    );
    v_next := v_next + 1;
    v_tries := v_tries + 1;
    if v_tries > 5000 then
      raise exception 'Could not find a free invoice number.' using errcode = 'P0001';
    end if;
  end loop;

  if p_reserve and v_has_settings then
    update public.business_settings
       set invoice_next_number = v_next + 1
     where user_id = v_business;
  end if;

  return v_candidate;
end;
$$;

revoke all on function public.sales_order_total(bigint), public.next_invoice_number(boolean) from public, anon;
grant execute on function public.sales_order_total(bigint), public.next_invoice_number(boolean) to authenticated;

commit;

-- ============================================================== ROLLBACK
-- begin;
-- (restore recompute_sales_order_payment's old v_total line:
--   select coalesce(sum(quantity * coalesce(unit_price, 0)), 0) into v_total
--   from public.sales_order_lines where sales_order_id = p_order_id;)
-- drop function if exists public.next_invoice_number(boolean);
-- drop function if exists public.sales_order_total(bigint);
-- alter table public.sales_orders drop constraint if exists sales_orders_tax_check,
--   drop column if exists tax_name, drop column if exists tax_rate, drop column if exists prices_include_tax;
-- alter table public.business_settings drop constraint if exists business_settings_invoice_numbering_check,
--   drop constraint if exists business_settings_tax_check,
--   drop column if exists invoice_prefix, drop column if exists invoice_next_number,
--   drop column if exists invoice_number_digits, drop column if exists po_prefix,
--   drop column if exists tax_enabled, drop column if exists tax_name,
--   drop column if exists tax_rate, drop column if exists prices_include_tax;
-- commit;
