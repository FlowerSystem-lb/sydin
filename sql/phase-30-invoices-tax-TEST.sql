-- TEST ONLY for phase-30-invoices-tax.sql. SAFE TO RUN: it ends with a
-- deliberate error, so Postgres throws EVERYTHING away -- the new columns,
-- functions and the test invoices. Nothing is saved.
-- Paste all of it into Supabase > SQL Editor > New query > Run, then copy the
-- red message back to Claude.
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


-- ===================== TEST HARNESS (never committed) =====================
select set_config('request.jwt.claims', '{"sub":"06042445-cbb3-45e6-a0c5-2f5dbb2c3b58","role":"authenticated"}', true);
create temp table r (k text, v text);

-- A: 2 x 50, VAT 11% added on top -> 100 + 11 = 111
insert into public.sales_orders (user_id, invoice_number, status, tax_name, tax_rate, prices_include_tax)
values ('06042445-cbb3-45e6-a0c5-2f5dbb2c3b58', 'ZZTEST-A', 'issued', 'VAT', 11, false);
insert into public.sales_order_lines (sales_order_id, name_snapshot, quantity, unit_price)
select id, 'Test item', 2, 50 from public.sales_orders where invoice_number = 'ZZTEST-A';
insert into r select 'A total (expect 111.00)', public.sales_order_total(id)::text from public.sales_orders where invoice_number = 'ZZTEST-A';

insert into public.sales_order_payments (sales_order_id, amount, user_id)
select id, 100, user_id from public.sales_orders where invoice_number = 'ZZTEST-A';
insert into r select 'A after paying 100 (expect partial)', payment_status from public.sales_orders where invoice_number = 'ZZTEST-A';
insert into public.sales_order_payments (sales_order_id, amount, user_id)
select id, 11, user_id from public.sales_orders where invoice_number = 'ZZTEST-A';
insert into r select 'A after paying 111 (expect paid)', payment_status from public.sales_orders where invoice_number = 'ZZTEST-A';

-- B: same lines, prices already include VAT -> 100
insert into public.sales_orders (user_id, invoice_number, status, tax_name, tax_rate, prices_include_tax)
values ('06042445-cbb3-45e6-a0c5-2f5dbb2c3b58', 'ZZTEST-B', 'issued', 'VAT', 11, true);
insert into public.sales_order_lines (sales_order_id, name_snapshot, quantity, unit_price)
select id, 'Test item', 2, 50 from public.sales_orders where invoice_number = 'ZZTEST-B';
insert into r select 'B inclusive total (expect 100)', public.sales_order_total(id)::text from public.sales_orders where invoice_number = 'ZZTEST-B';

-- C: no tax (every old invoice) -> 100
insert into public.sales_orders (user_id, invoice_number, status)
values ('06042445-cbb3-45e6-a0c5-2f5dbb2c3b58', 'ZZTEST-C', 'issued');
insert into public.sales_order_lines (sales_order_id, name_snapshot, quantity, unit_price)
select id, 'Test item', 2, 50 from public.sales_orders where invoice_number = 'ZZTEST-C';
insert into r select 'C no-tax total (expect 100)', public.sales_order_total(id)::text from public.sales_orders where invoice_number = 'ZZTEST-C';

-- Existing invoices: totals unchanged (all have no tax)
insert into r select 'Existing invoices changed (expect 0)', count(*)::text
  from public.sales_orders o
 where o.invoice_number not like 'ZZTEST-%'
   and public.sales_order_total(o.id) <> (select coalesce(sum(quantity * coalesce(unit_price, 0)), 0) from public.sales_order_lines where sales_order_id = o.id);

-- Numbering
insert into r values ('Next number preview', public.next_invoice_number(false));
insert into r values ('Preview again (expect same)', public.next_invoice_number(false));
insert into r values ('Reserved', public.next_invoice_number(true));
insert into r values ('Preview after reserve (expect +1)', public.next_invoice_number(false));
update public.business_settings set invoice_prefix = 'FP-', invoice_next_number = 7 where user_id = '06042445-cbb3-45e6-a0c5-2f5dbb2c3b58';
insert into r values ('Prefix FP- from 7 (expect FP-0007)', public.next_invoice_number(true));
insert into r values ('Then (expect FP-0008)', public.next_invoice_number(false));

do $$ begin raise exception E'TEST RESULTS (nothing was saved):\n%', (select string_agg(k || ': ' || v, E'\n') from r); end $$;
