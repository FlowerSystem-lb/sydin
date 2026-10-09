-- Phase 41: one receiving engine (9 Oct 2026, Sayed's Stock in spec).
--
-- purchase_order_receipts becomes THE receipt (goods received note) for every
-- stock that comes in from outside: a purchase order, no order (with a
-- reason), a customer return, or a Scanner receive session. Existing PO
-- deliveries keep their rows and their "PO/R1" numbers. New receipts get an
-- RCV-YYYYMMDD-NN reference; PO receipts also keep the PO/Rn reference.
--
-- confirm_stock_receipt does everything in one transaction: the receipt, its
-- lines, a stock_in movement per line for the good units (counted − damaged)
-- into the receipt's depot, the PO's received quantities and status
-- (backorder or close short), the item's last cost when the price changed,
-- and a line in the PO's activity. void_stock_receipt reverses one
-- (owner/admin only); nothing is ever hard-deleted.

alter table public.purchase_order_receipts
  alter column purchase_order_id drop not null,
  add column if not exists source text not null default 'po',
  add column if not exists reason text,
  add column if not exists reference text,
  add column if not exists po_reference text,
  add column if not exists depot_id bigint references public.depots (id) on delete set null,
  add column if not exists supplier_id bigint references public.suppliers (id) on delete set null,
  add column if not exists supplier_name text,
  add column if not exists delivery_note_no text,
  add column if not exists delivery_note_photo text,
  add column if not exists received_by text,
  add column if not exists short_action text,
  add column if not exists status text not null default 'confirmed',
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_order_receipts_source_check') then
    alter table public.purchase_order_receipts add constraint purchase_order_receipts_source_check
      check (source in ('po', 'no_order', 'return', 'scanner'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_order_receipts_status_check') then
    alter table public.purchase_order_receipts add constraint purchase_order_receipts_status_check
      check (status in ('confirmed', 'voided'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_order_receipts_short_action_check') then
    alter table public.purchase_order_receipts add constraint purchase_order_receipts_short_action_check
      check (short_action is null or short_action in ('backorder', 'close_short'));
  end if;
end $$;

alter table public.purchase_order_receipt_lines
  alter column purchase_order_line_id drop not null,
  add column if not exists expected_quantity numeric(12, 2),
  add column if not exists damaged_quantity numeric(12, 2) not null default 0,
  add column if not exists unit_cost numeric(12, 2),
  add column if not exists po_unit_cost numeric(12, 2),
  add column if not exists batch text,
  add column if not exists expiry_date date,
  add column if not exists note text;

-- A line may now be only damaged units (good quantity 0).
alter table public.purchase_order_receipt_lines drop constraint if exists purchase_order_receipt_lines_quantity_positive;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_order_receipt_lines_quantity_nonneg') then
    alter table public.purchase_order_receipt_lines add constraint purchase_order_receipt_lines_quantity_nonneg
      check (quantity >= 0 and damaged_quantity >= 0 and damaged_quantity <= quantity);
  end if;
end $$;

create index if not exists purchase_order_receipts_user_received on public.purchase_order_receipts (user_id, received_at desc);

-- ---------------------------------------------------------------------------
-- confirm_stock_receipt(p_receipt jsonb, p_lines jsonb) returns json
--   p_receipt: source, po_id, reason, depot_id, supplier_id, supplier_name,
--              delivery_note_no, delivery_note_photo, received_at, received_by,
--              short_action, notes, local_date (YYYYMMDD, the person's day)
--   p_lines:   [{ po_line_id?, item_id?, expected?, received, damaged,
--                 unit_cost?, batch?, expiry_date?, note? }]
--   received = what was counted (damaged included); good = received − damaged.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_stock_receipt(p_receipt jsonb, p_lines jsonb)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner uuid := public.current_business_id();
  v_source text := coalesce(p_receipt ->> 'source', 'no_order');
  v_po public.purchase_orders%rowtype;
  v_po_id bigint := nullif(p_receipt ->> 'po_id', '')::bigint;
  v_depot_id bigint := nullif(p_receipt ->> 'depot_id', '')::bigint;
  v_receipt_id bigint;
  v_day text := coalesce(nullif(p_receipt ->> 'local_date', ''), to_char(now(), 'YYYYMMDD'));
  v_reference text;
  v_po_reference text;
  v_seq integer;
  v_entry jsonb;
  v_line public.purchase_order_lines%rowtype;
  v_item_id bigint;
  v_received numeric(12, 2);
  v_damaged numeric(12, 2);
  v_good integer;
  v_cost numeric(12, 2);
  v_before integer;
  v_item_owner uuid;
  v_movement_id bigint;
  v_total_good integer := 0;
  v_total_received numeric := 0;
  v_total_damaged numeric := 0;
  v_outstanding numeric := 0;
  v_short_action text := nullif(p_receipt ->> 'short_action', '');
  v_status text;
  v_rate numeric;
  v_any boolean := false;
begin
  if v_owner is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not public.can_write() then
    raise exception 'Your role can only view this business.' using errcode = '42501';
  end if;
  if v_source not in ('po', 'no_order', 'return', 'scanner') then
    raise exception 'Unknown receipt source.' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Count at least one line.' using errcode = '22023';
  end if;
  if v_source = 'no_order' and coalesce(btrim(p_receipt ->> 'reason'), '') = '' then
    raise exception 'Choose why this stock is coming in.' using errcode = '23514';
  end if;
  if v_depot_id is not null and not exists (select 1 from public.depots where id = v_depot_id and user_id = v_owner) then
    raise exception 'Depot not found.' using errcode = '42501';
  end if;

  if v_source = 'po' then
    select * into v_po from public.purchase_orders where id = v_po_id for update;
    if not found or v_po.user_id <> v_owner then
      raise exception 'Purchase order not found.' using errcode = '42501';
    end if;
    if v_po.status not in ('draft', 'ordered', 'partially_received') then
      raise exception 'Only open purchase orders can be received.' using errcode = '55000';
    end if;
    v_depot_id := coalesce(v_depot_id, v_po.depot_id);
    v_rate := case when coalesce(v_po.exchange_rate, 0) > 0 then v_po.exchange_rate else 1 end;
    select count(*) + 1 into v_seq from public.purchase_order_receipts where purchase_order_id = v_po.id;
    v_po_reference := v_po.po_number || '/R' || v_seq;
    perform set_config('sydin.receive_purchase_order', 'on', true);
  end if;

  -- RCV-YYYYMMDD-NN, numbered per business per day.
  select count(*) + 1 into v_seq
    from public.purchase_order_receipts
   where user_id = v_owner and reference like 'RCV-' || v_day || '-%';
  v_reference := 'RCV-' || v_day || '-' || lpad(v_seq::text, 2, '0');

  insert into public.purchase_order_receipts (
    user_id, purchase_order_id, receipt_number, notes, received_at, source, reason, reference, po_reference,
    depot_id, supplier_id, supplier_name, delivery_note_no, delivery_note_photo, received_by, short_action
  ) values (
    v_owner,
    case when v_source = 'po' then v_po.id else null end,
    coalesce(v_po_reference, v_reference),
    nullif(btrim(coalesce(p_receipt ->> 'notes', '')), ''),
    coalesce(nullif(p_receipt ->> 'received_at', '')::timestamptz, now()),
    v_source,
    nullif(btrim(coalesce(p_receipt ->> 'reason', '')), ''),
    v_reference,
    v_po_reference,
    v_depot_id,
    case when v_source = 'po' then v_po.supplier_id else nullif(p_receipt ->> 'supplier_id', '')::bigint end,
    case when v_source = 'po' then v_po.supplier_name_snapshot else nullif(btrim(coalesce(p_receipt ->> 'supplier_name', '')), '') end,
    nullif(btrim(coalesce(p_receipt ->> 'delivery_note_no', '')), ''),
    nullif(btrim(coalesce(p_receipt ->> 'delivery_note_photo', '')), ''),
    nullif(btrim(coalesce(p_receipt ->> 'received_by', '')), ''),
    case when v_source = 'po' then coalesce(v_short_action, 'backorder') else null end
  ) returning id into v_receipt_id;

  for v_entry in select * from jsonb_array_elements(p_lines)
  loop
    v_received := coalesce((v_entry ->> 'received')::numeric, 0);
    v_damaged := least(greatest(coalesce((v_entry ->> 'damaged')::numeric, 0), 0), greatest(v_received, 0));
    if v_received < 0 then
      raise exception 'Counted quantities cannot be negative.' using errcode = '23514';
    end if;
    if v_received = 0 then
      continue;
    end if;
    v_cost := nullif(v_entry ->> 'unit_cost', '')::numeric;
    v_line := null;
    v_movement_id := null;

    if v_source = 'po' then
      select * into v_line from public.purchase_order_lines
       where id = (v_entry ->> 'po_line_id')::bigint and purchase_order_id = v_po.id
       for update;
      if not found then
        raise exception 'A line does not belong to this purchase order.' using errcode = '23503';
      end if;
      v_item_id := case when v_line.affects_stock then v_line.inventory_item_id else null end;
      if v_line.affects_stock and v_line.inventory_item_id is null then
        raise exception 'The item for "%" was deleted. Edit the order before receiving it.', v_line.name_snapshot using errcode = '23514';
      end if;
    else
      v_item_id := (v_entry ->> 'item_id')::bigint;
      if v_item_id is null then
        raise exception 'Each line needs an item.' using errcode = '23514';
      end if;
    end if;

    v_good := round(v_received - v_damaged)::integer;
    if v_item_id is not null and (v_received - v_damaged) <> v_good then
      raise exception 'Stock quantities must be whole numbers.' using errcode = '23514';
    end if;

    if v_item_id is not null then
      select i.user_id, i.quantity into v_item_owner, v_before from public.inventory i where i.id = v_item_id for update;
      if v_item_owner is null or v_item_owner <> v_owner then
        raise exception 'Item not found.' using errcode = '42501';
      end if;
      if v_good > 0 then
        update public.inventory set quantity = v_before + v_good where id = v_item_id;
        insert into public.stock_movements (
          user_id, item_id, depot_id, movement_type, quantity_delta, quantity_before, quantity_after, notes,
          purchase_order_id, purchase_order_line_id, purchase_order_receipt_id
        ) values (
          v_owner, v_item_id, v_depot_id, 'stock_in', v_good, v_before, v_before + v_good,
          'Stock in ' || v_reference
            || case when v_source = 'po' then ' · ' || v_po_reference
                    when v_source = 'return' then ' · customer return'
                    when v_source = 'scanner' then ' · Scanner'
                    else ' · ' || replace(coalesce(p_receipt ->> 'reason', 'no order'), '_', ' ') end
            || case when v_damaged > 0 then ' · ' || trim_scale(v_damaged) || ' damaged' else '' end,
          case when v_source = 'po' then v_po.id else null end,
          case when v_source = 'po' then v_line.id else null end,
          v_receipt_id
        ) returning id into v_movement_id;
      end if;

      -- A changed price becomes the item's last cost (stored in base currency).
      if v_cost is not null and v_cost > 0 then
        if v_source = 'po' then
          if v_line.unit_cost is distinct from v_cost then
            update public.inventory set cost_price = round(v_cost / v_rate, 2) where id = v_item_id;
          end if;
        else
          update public.inventory set cost_price = v_cost where id = v_item_id;
        end if;
      end if;
    end if;

    insert into public.purchase_order_receipt_lines (
      receipt_id, purchase_order_line_id, inventory_item_id, quantity, damaged_quantity, expected_quantity,
      unit_cost, po_unit_cost, batch, expiry_date, note, stock_movement_id
    ) values (
      v_receipt_id,
      case when v_source = 'po' then v_line.id else null end,
      coalesce(v_item_id, case when v_source = 'po' then v_line.inventory_item_id else null end),
      v_received,
      v_damaged,
      nullif(v_entry ->> 'expected', '')::numeric,
      v_cost,
      case when v_source = 'po' then v_line.unit_cost else null end,
      nullif(btrim(coalesce(v_entry ->> 'batch', '')), ''),
      nullif(v_entry ->> 'expiry_date', '')::date,
      nullif(btrim(coalesce(v_entry ->> 'note', '')), ''),
      v_movement_id
    );

    if v_source = 'po' then
      update public.purchase_order_lines set received_quantity = received_quantity + v_received where id = v_line.id;
    end if;

    v_total_good := v_total_good + v_good;
    v_total_received := v_total_received + v_received;
    v_total_damaged := v_total_damaged + v_damaged;
    v_any := true;
  end loop;

  if not v_any and not (v_source = 'po' and v_short_action = 'close_short') then
    raise exception 'Count at least one line.' using errcode = '23514';
  end if;
  if not v_any then
    delete from public.purchase_order_receipts where id = v_receipt_id;
    v_receipt_id := null;
  end if;

  if v_source = 'po' then
    select coalesce(sum(greatest(quantity - received_quantity, 0)), 0) into v_outstanding
      from public.purchase_order_lines where purchase_order_id = v_po.id;
    if v_outstanding <= 0 or v_short_action = 'close_short' then
      update public.purchase_orders
         set status = 'received', received_at = now(), cancelled_at = null, closed_short = (v_outstanding > 0)
       where id = v_po.id;
      v_status := 'received';
    else
      update public.purchase_orders
         set status = 'partially_received', received_at = null, cancelled_at = null
       where id = v_po.id;
      v_status := 'partially_received';
    end if;
    insert into public.purchase_order_activity (purchase_order_id, user_id, type, text)
    values (
      v_po.id, v_owner, 'received',
      'Received ' || v_total_good || ' into stock (' || v_reference || ')'
        || case when v_total_damaged > 0 then ' · ' || trim_scale(v_total_damaged) || ' damaged' else '' end
        || case when v_outstanding > 0 and v_short_action = 'close_short' then ' · closed short' when v_outstanding > 0 then ' · ' || trim_scale(v_outstanding) || ' on backorder' else '' end
    );
  end if;

  return json_build_object(
    'receipt_id', v_receipt_id,
    'reference', v_reference,
    'po_reference', v_po_reference,
    'po_status', v_status,
    'outstanding', v_outstanding,
    'good', v_total_good,
    'received', v_total_received,
    'damaged', v_total_damaged
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- void_stock_receipt: reverses a confirmed receipt (owner / admin only).
-- ---------------------------------------------------------------------------
create or replace function public.void_stock_receipt(p_receipt_id bigint, p_reason text default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner uuid := public.current_business_id();
  v_receipt public.purchase_order_receipts%rowtype;
  v_line record;
  v_good integer;
  v_before integer;
  v_outstanding numeric;
  v_any_received numeric;
  v_ref text;
begin
  if v_owner is null or not public.can_delete() then
    raise exception 'Only the owner or an admin can void a receipt.' using errcode = '42501';
  end if;
  select * into v_receipt from public.purchase_order_receipts where id = p_receipt_id for update;
  if not found or v_receipt.user_id <> v_owner then
    raise exception 'Receipt not found.' using errcode = '42501';
  end if;
  if v_receipt.status = 'voided' then
    raise exception 'This receipt is already voided.' using errcode = '55000';
  end if;
  v_ref := coalesce(v_receipt.reference, v_receipt.receipt_number);

  if v_receipt.purchase_order_id is not null then
    perform set_config('sydin.receive_purchase_order', 'on', true);
    perform set_config('sydin.void_receipt', 'on', true);
  end if;

  for v_line in
    select l.*, m.quantity_delta as moved
      from public.purchase_order_receipt_lines l
      left join public.stock_movements m on m.id = l.stock_movement_id
     where l.receipt_id = p_receipt_id
  loop
    v_good := coalesce(v_line.moved, 0);
    if v_good > 0 and v_line.inventory_item_id is not null then
      select quantity into v_before from public.inventory where id = v_line.inventory_item_id and user_id = v_owner for update;
      if v_before is not null then
        if v_before < v_good then
          raise exception 'Not enough stock left to void this receipt (some was already sold or moved).' using errcode = '23514';
        end if;
        update public.inventory set quantity = v_before - v_good where id = v_line.inventory_item_id;
        insert into public.stock_movements (
          user_id, item_id, depot_id, movement_type, quantity_delta, quantity_before, quantity_after, notes,
          purchase_order_id, purchase_order_line_id, purchase_order_receipt_id
        ) values (
          v_owner, v_line.inventory_item_id, v_receipt.depot_id, 'stock_out', -v_good, v_before, v_before - v_good,
          'Voided ' || v_ref || coalesce(' · ' || nullif(btrim(p_reason), ''), ''),
          v_receipt.purchase_order_id, v_line.purchase_order_line_id, p_receipt_id
        );
      end if;
    end if;
    if v_line.purchase_order_line_id is not null then
      update public.purchase_order_lines
         set received_quantity = greatest(received_quantity - v_line.quantity, 0)
       where id = v_line.purchase_order_line_id;
    end if;
  end loop;

  update public.purchase_order_receipts
     set status = 'voided', voided_at = now(), voided_by = auth.uid()
   where id = p_receipt_id;

  if v_receipt.purchase_order_id is not null then
    select coalesce(sum(greatest(quantity - received_quantity, 0)), 0), coalesce(sum(received_quantity), 0)
      into v_outstanding, v_any_received
      from public.purchase_order_lines where purchase_order_id = v_receipt.purchase_order_id;
    -- Status goes back by a step; the normalize trigger allows it while receiving.
    update public.purchase_orders
       set status = case when v_any_received > 0 then 'partially_received' else 'ordered' end,
           received_at = null, closed_short = false
     where id = v_receipt.purchase_order_id and status in ('partially_received', 'received');
    insert into public.purchase_order_activity (purchase_order_id, user_id, type, text)
    values (v_receipt.purchase_order_id, v_owner, 'edited', 'Receipt ' || v_ref || ' voided' || coalesce(' · ' || nullif(btrim(p_reason), ''), ''));
  end if;

  return json_build_object('voided', p_receipt_id);
end;
$function$;

revoke all on function public.confirm_stock_receipt(jsonb, jsonb) from public;
revoke all on function public.void_stock_receipt(bigint, text) from public;
grant execute on function public.confirm_stock_receipt(jsonb, jsonb) to authenticated;
grant execute on function public.void_stock_receipt(bigint, text) to authenticated;

-- Voiding a receipt moves its order back a step (received → partly received
-- → ordered), which the status guard otherwise forbids. The bypass is only
-- on inside void_stock_receipt (transaction-local setting).
create or replace function public.normalize_purchase_order()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  receiving boolean :=
    coalesce(current_setting('sydin.receive_purchase_order', true), '') = 'on';
  voiding boolean :=
    coalesce(current_setting('sydin.void_receipt', true), '') = 'on';
begin
  new.po_number = btrim(new.po_number);
  new.title = nullif(btrim(coalesce(new.title, '')), '');
  new.supplier_name_snapshot = nullif(btrim(coalesce(new.supplier_name_snapshot, '')), '');
  new.supplier_contact_snapshot = nullif(btrim(coalesce(new.supplier_contact_snapshot, '')), '');
  new.depot_name_snapshot = nullif(btrim(coalesce(new.depot_name_snapshot, '')), '');
  new.paid_by = nullif(btrim(coalesce(new.paid_by, '')), '');
  new.notes = nullif(btrim(coalesce(new.notes, '')), '');
  new.internal_reference = nullif(btrim(coalesce(new.internal_reference, '')), '');
  new.attachment_label = nullif(btrim(coalesce(new.attachment_label, '')), '');

  if public.current_business_id() is null or new.user_id <> public.current_business_id() then
    raise exception 'Purchase order must belong to the authenticated user.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'ordered') then
      raise exception 'New purchase orders must start as draft or ordered.'
        using errcode = '23514';
    end if;
    new.received_at = null;
    new.cancelled_at = null;
    new.closed_short = false;
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Purchase order ownership cannot be changed.'
      using errcode = '23514';
  end if;

  if voiding and old.status in ('received', 'partially_received')
     and new.status in ('partially_received', 'ordered') then
    new.updated_at = now();
    return new;
  end if;

  if old.status = new.status then
    if new.closed_short is distinct from old.closed_short and not receiving then
      new.closed_short = old.closed_short;
    end if;
    new.updated_at = now();
    return new;
  end if;

  if old.status = 'received' then
    raise exception 'Received purchase orders cannot change status.'
      using errcode = '55000';
  end if;

  if old.status = 'cancelled' then
    raise exception 'Cancelled purchase orders cannot change status.'
      using errcode = '55000';
  end if;

  if old.status = 'partially_received' and new.status <> 'received' then
    raise exception
      'Stock has already been received on this order. Receive the rest, or close it short.'
      using errcode = '55000';
  end if;

  if new.status in ('received', 'partially_received') and not receiving then
    raise exception 'Purchase orders must be received through receive_purchase_order_lines.'
      using errcode = '42501';
  end if;

  if new.status = 'cancelled' then
    new.cancelled_at = coalesce(new.cancelled_at, now());
    new.received_at = null;
  elsif new.status in ('draft', 'ordered', 'partially_received') then
    new.cancelled_at = null;
    new.received_at = null;
  end if;

  new.updated_at = now();
  return new;
end;
$function$;
