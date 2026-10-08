-- Phase 40: Purchase orders redesign (9 Oct 2026, Sayed's PO spec).
-- Additive only. Existing orders keep their numbers: discount and delivery
-- default to 0, so every total stays what it was.

alter table public.purchase_orders
  add column if not exists discount numeric(12, 2) not null default 0,
  add column if not exists delivery_fee numeric(12, 2) not null default 0,
  add column if not exists payment_terms text,
  add column if not exists ordered_at timestamptz,
  add column if not exists public_token uuid not null default gen_random_uuid();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_discount_check') then
    alter table public.purchase_orders add constraint purchase_orders_discount_check check (discount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_delivery_fee_check') then
    alter table public.purchase_orders add constraint purchase_orders_delivery_fee_check check (delivery_fee >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_orders_payment_terms_check') then
    alter table public.purchase_orders add constraint purchase_orders_payment_terms_check
      check (payment_terms is null or payment_terms in ('on_delivery', 'paid_now', 'net_7', 'net_30'));
  end if;
end $$;

create unique index if not exists purchase_orders_public_token_unique on public.purchase_orders (public_token);

-- Orders placed before this phase have no ordered_at; the app shows their
-- created date for the "Ordered" step. (A backfill UPDATE here would trip
-- normalize_purchase_order's ownership check, which needs a signed-in user.)

-- Payment status now compares against lines − discount + delivery.
create or replace function public.recompute_purchase_order_payment(p_order_id bigint)
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
  v_discount numeric(12, 2);
  v_delivery numeric(12, 2);
begin
  select user_id, coalesce(discount, 0), coalesce(delivery_fee, 0)
    into v_owner, v_discount, v_delivery
    from public.purchase_orders where id = p_order_id;
  if v_owner is null then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_paid
    from public.purchase_order_payments where purchase_order_id = p_order_id;

  select greatest(coalesce(sum(quantity * coalesce(unit_cost, 0)), 0) - v_discount + v_delivery, 0)
    into v_total
    from public.purchase_order_lines where purchase_order_id = p_order_id;

  if v_paid <= 0 then
    v_status := 'unpaid';
  elsif v_total > 0 and v_paid >= v_total then
    v_status := 'paid';
  else
    v_status := 'partial';
  end if;

  update public.purchase_orders
     set amount_paid = v_paid, payment_status = v_status
   where id = p_order_id;
end;
$function$;

-- A changed discount or delivery fee re-checks the payment status.
create or replace function public.on_purchase_order_charges_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.recompute_purchase_order_payment(new.id);
  return new;
end;
$function$;

drop trigger if exists purchase_orders_charges_recompute on public.purchase_orders;
create trigger purchase_orders_charges_recompute
  after update of discount, delivery_fee on public.purchase_orders
  for each row
  when (old.discount is distinct from new.discount or old.delivery_fee is distinct from new.delivery_fee)
  execute function public.on_purchase_order_charges_change();

-- Activity timeline: created, placed, sent, received, paid, edited, cancelled.
create table if not exists public.purchase_order_activity (
  id bigint generated always as identity primary key,
  purchase_order_id bigint not null references public.purchase_orders (id) on delete cascade,
  user_id uuid not null,
  actor_id uuid default auth.uid(),
  type text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists purchase_order_activity_order on public.purchase_order_activity (purchase_order_id, created_at desc);
alter table public.purchase_order_activity enable row level security;

drop policy if exists "Read activity of own purchase orders" on public.purchase_order_activity;
create policy "Read activity of own purchase orders" on public.purchase_order_activity
  for select using ((select public.current_business_id()) = user_id);
drop policy if exists "Write activity of own purchase orders" on public.purchase_order_activity;
create policy "Write activity of own purchase orders" on public.purchase_order_activity
  for insert with check (
    (select public.current_business_id()) = user_id
    and exists (select 1 from public.purchase_orders po where po.id = purchase_order_activity.purchase_order_id and po.user_id = purchase_order_activity.user_id)
  );
drop policy if exists "Two-step verification when on" on public.purchase_order_activity;
create policy "Two-step verification when on" on public.purchase_order_activity
  as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- The supplier's link (WhatsApp, PDF QR): read-only, by the order's random
-- token. Drafts are never shared; costs are what the supplier was sent.
create or replace function public.get_public_purchase_order(p_token uuid)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_order public.purchase_orders;
  v_result json;
begin
  select * into v_order from public.purchase_orders where public_token = p_token;
  if v_order.id is null or v_order.status = 'draft' then
    return null;
  end if;

  select json_build_object(
    'order', json_build_object(
      'po_number', v_order.po_number,
      'title', v_order.title,
      'status', v_order.status,
      'payment_status', v_order.payment_status,
      'purchase_date', v_order.purchase_date,
      'expected_delivery_date', v_order.expected_delivery_date,
      'payment_terms', v_order.payment_terms,
      'internal_reference', v_order.internal_reference,
      'notes', v_order.notes,
      'currency_code', v_order.currency_code,
      'discount', v_order.discount,
      'delivery_fee', v_order.delivery_fee,
      'amount_paid', v_order.amount_paid,
      'supplier_name', v_order.supplier_name_snapshot,
      'supplier_contact', v_order.supplier_contact_snapshot,
      'depot_name', v_order.depot_name_snapshot
    ),
    'lines', coalesce((
      select json_agg(json_build_object(
        'name', l.name_snapshot,
        'code', coalesce(l.item_code_snapshot, l.sku_snapshot),
        'unit', l.unit_label_snapshot,
        'line_type', l.line_type,
        'quantity', l.quantity,
        'received_quantity', l.received_quantity,
        'unit_cost', l.unit_cost,
        'notes', l.notes
      ) order by l.id)
      from public.purchase_order_lines l where l.purchase_order_id = v_order.id
    ), '[]'::json),
    'payments', coalesce((
      select json_agg(json_build_object('amount', p.amount, 'method', p.method, 'paid_at', p.paid_at) order by p.paid_at)
      from public.purchase_order_payments p where p.purchase_order_id = v_order.id
    ), '[]'::json),
    'business', (
      select json_build_object(
        'name', bs.business_name, 'logo_url', bs.business_logo_url, 'phone', bs.contact_phone,
        'email', bs.contact_email, 'tax_id', bs.tax_id, 'address', bs.business_address
      ) from public.business_settings bs where bs.user_id = v_order.user_id limit 1
    ),
    'depot', (
      select json_build_object('name', d.name, 'address', d.address, 'phone', d.phone)
      from public.depots d where d.id = v_order.depot_id
    ),
    'supplier', (
      select json_build_object('name', s.name, 'contact_name', s.contact_name, 'phone', s.phone, 'email', s.email, 'address', s.address)
      from public.suppliers s where s.id = v_order.supplier_id
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_public_purchase_order(uuid) from public;
grant execute on function public.get_public_purchase_order(uuid) to anon, authenticated;
