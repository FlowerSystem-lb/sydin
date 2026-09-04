-- SydIN Phase 21: Issuing an invoice takes the goods out of stock
--
-- Step 3 of the sales module, and the first one that changes inventory.
--
-- WHY A DATABASE FUNCTION AND NOT A LOOP IN THE APP. Issuing a five-line
-- invoice is five stock movements plus a status change. Done from the browser
-- that is six round trips with no transaction around them: lose the connection
-- after the third and the depot is left with three products gone, two still
-- counted, and an invoice that never got marked issued. Inside one function it
-- is one transaction -- all six happen or none do.
--
-- This mirrors `receive_purchase_order`, which solved the same problem for the
-- buy side and has been in production for months. Same locking order, same
-- ownership checks, same idempotency guard. The differences are the direction
-- of the arithmetic and one extra rule: receiving can always add, but issuing
-- must refuse to take out more than exists.
--
-- Run manually in the Supabase SQL editor after reviewing, then test it by
-- trying to break it. A clean run proves nothing.

begin;

-- Same shape as the purchase-order and pick-list links already on this table.
-- The line id is what makes issuing idempotent: a movement already carrying a
-- sales_order_line_id means that line has been shipped, so a second attempt is
-- refused rather than silently taking the stock twice.
alter table public.stock_movements
  add column if not exists sales_order_id bigint null,
  add column if not exists sales_order_line_id bigint null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_movements_sales_order_id_fkey'
      and conrelid = 'public.stock_movements'::regclass
  ) then
    alter table public.stock_movements
      add constraint stock_movements_sales_order_id_fkey
      foreign key (sales_order_id)
      references public.sales_orders(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_movements_sales_order_line_id_fkey'
      and conrelid = 'public.stock_movements'::regclass
  ) then
    alter table public.stock_movements
      add constraint stock_movements_sales_order_line_id_fkey
      foreign key (sales_order_line_id)
      references public.sales_order_lines(id) on delete set null;
  end if;
end
$$;

create index if not exists stock_movements_sales_order_idx
  on public.stock_movements (sales_order_id);

create or replace function public.issue_sales_order(p_sales_order_id bigint)
returns public.sales_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  authenticated_user_id uuid;
  target_order public.sales_orders%rowtype;
  line_record record;
  quantity_before integer;
  quantity_to_remove integer;
begin
  authenticated_user_id := auth.uid();

  if authenticated_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select *
  into target_order
  from public.sales_orders
  where id = p_sales_order_id
  for update;

  -- "Not found" rather than "not yours": an error message should never confirm
  -- that someone else's invoice exists.
  if not found or target_order.user_id <> authenticated_user_id then
    raise exception 'Invoice not found.'
      using errcode = '42501';
  end if;

  if target_order.status <> 'draft' then
    raise exception 'Only a draft invoice can be issued.'
      using errcode = '55000';
  end if;

  perform sol.id
  from public.sales_order_lines sol
  where sol.sales_order_id = p_sales_order_id
  order by sol.id
  for update;

  if not exists (
    select 1 from public.sales_order_lines
    where sales_order_id = p_sales_order_id
  ) then
    raise exception 'Add at least one line before issuing this invoice.'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.sales_order_lines
    where sales_order_id = p_sales_order_id
      and affects_stock
      and inventory_item_id is null
  ) then
    raise exception
      'A stock-affecting line lost its product. Edit the line before issuing.'
      using errcode = '23514';
  end if;

  -- Lock every affected product, ordered by id. The order is what stops two
  -- invoices sharing products from deadlocking against each other.
  perform i.id
  from public.inventory i
  join public.sales_order_lines sol
    on sol.inventory_item_id = i.id
  where sol.sales_order_id = p_sales_order_id
    and sol.affects_stock
  order by i.id
  for update of i;

  for line_record in
    select
      sol.id as line_id,
      sol.inventory_item_id,
      sol.quantity,
      sol.name_snapshot,
      i.user_id as inventory_user_id,
      i.quantity as inventory_quantity
    from public.sales_order_lines sol
    join public.inventory i on i.id = sol.inventory_item_id
    where sol.sales_order_id = p_sales_order_id
      and sol.affects_stock
    order by i.id
  loop
    if line_record.inventory_user_id <> authenticated_user_id then
      raise exception 'Product ownership does not match the invoice.'
        using errcode = '42501';
    end if;

    if exists (
      select 1 from public.stock_movements sm
      where sm.sales_order_line_id = line_record.line_id
    ) then
      raise exception 'Stock has already been taken out for this invoice line.'
        using errcode = '23505';
    end if;

    -- Deliberately stricter than the purchase-order equivalent, which rounds.
    -- Rounding an outgoing quantity up would ship more than the invoice says,
    -- and half a piece cannot leave a depot anyway.
    if line_record.quantity <> round(line_record.quantity) then
      raise exception 'Quantity for % must be a whole number to leave stock.',
        line_record.name_snapshot
        using errcode = '23514';
    end if;

    quantity_to_remove := line_record.quantity::integer;

    if quantity_to_remove <= 0 then
      raise exception 'Quantity for % must be above zero.',
        line_record.name_snapshot
        using errcode = '23514';
    end if;

    quantity_before := line_record.inventory_quantity;

    -- The rule receiving never needed. Refused here rather than in the browser
    -- so it holds however the invoice was issued.
    if quantity_before - quantity_to_remove < 0 then
      raise exception
        'Only % of % in stock, but the invoice sells %.',
        quantity_before, line_record.name_snapshot, quantity_to_remove
        using errcode = '23514';
    end if;

    update public.inventory
    set quantity = quantity_before - quantity_to_remove
    where id = line_record.inventory_item_id
      and user_id = authenticated_user_id;

    insert into public.stock_movements (
      user_id,
      item_id,
      movement_type,
      quantity_delta,
      quantity_before,
      quantity_after,
      notes,
      sales_order_id,
      sales_order_line_id
    )
    values (
      authenticated_user_id,
      line_record.inventory_item_id,
      'stock_out',
      -quantity_to_remove,
      quantity_before,
      quantity_before - quantity_to_remove,
      'Invoice ' || target_order.invoice_number,
      p_sales_order_id,
      line_record.line_id
    );
  end loop;

  update public.sales_orders
  set
    status = 'issued',
    issued_at = now(),
    cancelled_at = null
  where id = p_sales_order_id
  returning * into target_order;

  return target_order;
end;
$$;

-- Phases 15 and 16 both learned this the hard way: revoking from named roles
-- does nothing while PUBLIC still holds EXECUTE, because PostgreSQL grants it
-- to PUBLIC by default. Revoke from PUBLIC first, then grant deliberately.
revoke all on function public.issue_sales_order(bigint) from public;
revoke all on function public.issue_sales_order(bigint) from anon;
grant execute on function public.issue_sales_order(bigint) to authenticated;

commit;
