-- SydIN Phase 28: Team access -- employees work inside the owner's business
--
-- THE IDEA. A business is its owner's user id. Every row in every table already
-- carries user_id = that owner, so nothing is copied or moved. A team member's
-- login is mapped to the owner's id by current_business_id(); for anyone
-- without a team (every account before this file) it returns auth.uid(), so
-- solo accounts behave exactly as before.
--
-- ROLES. owner (implicit: you are the owner of your own id) · admin · staff ·
-- viewer. Reads: everyone in the business. Adds and edits: owner/admin/staff.
-- Deleting whole records and payments: owner/admin. Business settings: owner/
-- admin. Line-level deletes inside a document (invoice/PO/pick-list lines) are
-- part of editing that document, so staff may do them.
--
-- APPLIED 27 Sep 2026 by Sayed in the Supabase SQL Editor ("Success. No rows
-- returned"), after phase-28-team-access-TEST.sql passed for owner, admin,
-- staff, viewer and a stranger. The body below is byte-for-byte the one that
-- test ran (it was rebuilt from the test file after this file was accidentally
-- overwritten on disk).
--
-- Rollback block at the end (commented).

begin;

-- ---------------------------------------------------------------- 1. table
create table if not exists public.business_members (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid null references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'staff', 'viewer')),
  status text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz null,
  constraint business_members_email_normalised check (email = lower(btrim(email))),
  constraint business_members_not_self check (member_id is distinct from owner_id),
  constraint business_members_active_has_member check (status <> 'active' or member_id is not null)
);

create unique index if not exists business_members_owner_email_key
  on public.business_members (owner_id, email);
-- One business at a time per person.
create unique index if not exists business_members_one_active_key
  on public.business_members (member_id) where status = 'active';
create index if not exists business_members_email_idx
  on public.business_members (email) where status = 'invited';

alter table public.business_members enable row level security;
revoke all on public.business_members from anon, authenticated;
grant select on public.business_members to authenticated;

-- ---------------------------------------------------------------- 2. helpers
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select bm.owner_id
       from public.business_members bm
      where bm.member_id = auth.uid() and bm.status = 'active'
      limit 1),
    auth.uid()
  );
$$;

create or replace function public.current_business_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    else coalesce(
      (select bm.role
         from public.business_members bm
        where bm.member_id = auth.uid() and bm.status = 'active'
        limit 1),
      'owner')
  end;
$$;

create or replace function public.can_write()
returns boolean language sql stable set search_path = ''
as $$ select coalesce(public.current_business_role() in ('owner', 'admin', 'staff'), false); $$;

create or replace function public.can_delete()
returns boolean language sql stable set search_path = ''
as $$ select coalesce(public.current_business_role() in ('owner', 'admin'), false); $$;

create or replace function public.can_manage_business()
returns boolean language sql stable set search_path = ''
as $$ select coalesce(public.current_business_role() in ('owner', 'admin'), false); $$;

create policy "Members see their business team"
  on public.business_members for select to authenticated
  using (
    member_id = (select auth.uid())
    or owner_id = (select auth.uid())
    or (owner_id = (select public.current_business_id()) and (select public.can_manage_business()))
    or (status = 'invited' and email = lower((select auth.jwt()) ->> 'email'))
  );

-- ---------------------------------------------------------------- 3. policies
-- Generated from pg_policies on 27 Sep 2026: every "( SELECT auth.uid() AS uid)"
-- replaced by "( SELECT public.current_business_id() AS uid)" plus a role gate.
-- plan_requests and user_subscriptions' INSERT are left as they were.
ALTER POLICY asset_events_user_isolation ON public.asset_events
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can insert own business settings" ON public.business_settings
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_manage_business()));
ALTER POLICY "Users can view own business settings" ON public.business_settings
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update own business settings" ON public.business_settings
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_manage_business()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_manage_business()));
ALTER POLICY "Users can delete own categories" ON public.categories
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_delete()));
ALTER POLICY "Users can create own categories" ON public.categories
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own categories" ON public.categories
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update own categories" ON public.categories
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can delete own customers" ON public.customers
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_delete()));
ALTER POLICY "Users can create own customers" ON public.customers
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own customers" ON public.customers
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update own customers" ON public.customers
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can delete their depots" ON public.depots
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_delete()));
ALTER POLICY "Users can create their depots" ON public.depots
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view their depots" ON public.depots
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update their depots" ON public.depots
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can insert their own device pairings" ON public.device_pairings
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view their own device pairings" ON public.device_pairings
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update their own device pairings" ON public.device_pairings
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can insert their own import export history" ON public.import_export_history
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view their own import export history" ON public.import_export_history
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update their own import export history" ON public.import_export_history
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Enable delete for users based on user_id" ON public.inventory
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_delete()));
ALTER POLICY "Enable insert for users based on user_id" ON public.inventory
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own inventory" ON public.inventory
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update own inventory" ON public.inventory
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY inventory_assets_user_isolation ON public.inventory_assets
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY inventory_depot_transfers_user_isolation ON public.inventory_depot_transfers
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can insert their own inventory history" ON public.inventory_history
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view their own inventory history" ON public.inventory_history
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can delete their own notifications" ON public.notifications
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can insert their own notifications" ON public.notifications
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view their own notifications" ON public.notifications
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update their own notifications" ON public.notifications
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can insert barcodes for their pairings" ON public.pairing_barcodes
  WITH CHECK (((EXISTS ( SELECT 1
   FROM device_pairings dp
  WHERE ((dp.id = pairing_barcodes.pairing_id) AND (dp.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can view barcodes for their pairings" ON public.pairing_barcodes
  USING (((EXISTS ( SELECT 1
   FROM device_pairings dp
  WHERE ((dp.id = pairing_barcodes.pairing_id) AND (dp.user_id = ( SELECT public.current_business_id() AS uid)))))));
ALTER POLICY "Users can update barcodes for their pairings" ON public.pairing_barcodes
  USING (((EXISTS ( SELECT 1
   FROM device_pairings dp
  WHERE ((dp.id = pairing_barcodes.pairing_id) AND (dp.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can delete own active pick list items" ON public.pick_list_items
  USING (((EXISTS ( SELECT 1
   FROM pick_lists pl
  WHERE ((pl.id = pick_list_items.pick_list_id) AND (pl.user_id = ( SELECT public.current_business_id() AS uid)) AND (pl.status = ANY (ARRAY['draft'::text, 'preparing'::text])))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can create own active pick list items" ON public.pick_list_items
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM pick_lists pl
  WHERE ((pl.id = pick_list_items.pick_list_id) AND (pl.user_id = ( SELECT public.current_business_id() AS uid)) AND (pl.status = ANY (ARRAY['draft'::text, 'preparing'::text]))))) AND ((inventory_item_id IS NULL) OR (EXISTS ( SELECT 1
   FROM inventory i
  WHERE ((i.id = pick_list_items.inventory_item_id) AND (i.user_id = ( SELECT public.current_business_id() AS uid)))))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own pick list items" ON public.pick_list_items
  USING (((EXISTS ( SELECT 1
   FROM pick_lists pl
  WHERE ((pl.id = pick_list_items.pick_list_id) AND (pl.user_id = ( SELECT public.current_business_id() AS uid)))))));
ALTER POLICY "Users can update own active pick list items" ON public.pick_list_items
  USING (((EXISTS ( SELECT 1
   FROM pick_lists pl
  WHERE ((pl.id = pick_list_items.pick_list_id) AND (pl.user_id = ( SELECT public.current_business_id() AS uid)) AND (pl.status = ANY (ARRAY['draft'::text, 'preparing'::text])))))) AND (SELECT public.can_write()))
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM pick_lists pl
  WHERE ((pl.id = pick_list_items.pick_list_id) AND (pl.user_id = ( SELECT public.current_business_id() AS uid)) AND (pl.status = ANY (ARRAY['draft'::text, 'preparing'::text]))))) AND ((inventory_item_id IS NULL) OR (EXISTS ( SELECT 1
   FROM inventory i
  WHERE ((i.id = pick_list_items.inventory_item_id) AND (i.user_id = ( SELECT public.current_business_id() AS uid)))))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can delete active own pick lists" ON public.pick_lists
  USING ((((( SELECT public.current_business_id() AS uid) = user_id) AND (status = ANY (ARRAY['draft'::text, 'preparing'::text])))) AND (SELECT public.can_delete()));
ALTER POLICY "Users can create own pick lists" ON public.pick_lists
  WITH CHECK ((((( SELECT public.current_business_id() AS uid) = user_id) AND (status = 'draft'::text))) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own pick lists" ON public.pick_lists
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update active own pick lists" ON public.pick_lists
  USING ((((( SELECT public.current_business_id() AS uid) = user_id) AND (status = ANY (ARRAY['draft'::text, 'preparing'::text])))) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can delete own active purchase order lines" ON public.purchase_order_lines
  USING (((EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_lines.purchase_order_id) AND (po.user_id = ( SELECT public.current_business_id() AS uid)) AND (po.status = ANY (ARRAY['draft'::text, 'ordered'::text])))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can create own active purchase order lines" ON public.purchase_order_lines
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_lines.purchase_order_id) AND (po.user_id = ( SELECT public.current_business_id() AS uid)) AND (po.status = ANY (ARRAY['draft'::text, 'ordered'::text]))))) AND ((inventory_item_id IS NULL) OR (EXISTS ( SELECT 1
   FROM inventory i
  WHERE ((i.id = purchase_order_lines.inventory_item_id) AND (i.user_id = ( SELECT public.current_business_id() AS uid)))))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own purchase order lines" ON public.purchase_order_lines
  USING (((EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_lines.purchase_order_id) AND (po.user_id = ( SELECT public.current_business_id() AS uid)))))));
ALTER POLICY "Users can update own active purchase order lines" ON public.purchase_order_lines
  USING (((EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_lines.purchase_order_id) AND (po.user_id = ( SELECT public.current_business_id() AS uid)) AND (po.status = ANY (ARRAY['draft'::text, 'ordered'::text])))))) AND (SELECT public.can_write()))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_lines.purchase_order_id) AND (po.user_id = ( SELECT public.current_business_id() AS uid)) AND (po.status = ANY (ARRAY['draft'::text, 'ordered'::text])))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can delete own PO payments" ON public.purchase_order_payments
  USING (((EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_payments.purchase_order_id) AND (po.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_delete()));
ALTER POLICY "Users can add own PO payments" ON public.purchase_order_payments
  WITH CHECK (((EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_payments.purchase_order_id) AND (po.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own PO payments" ON public.purchase_order_payments
  USING (((EXISTS ( SELECT 1
   FROM purchase_orders po
  WHERE ((po.id = purchase_order_payments.purchase_order_id) AND (po.user_id = ( SELECT public.current_business_id() AS uid)))))));
ALTER POLICY "Users can view own purchase order receipt lines" ON public.purchase_order_receipt_lines
  USING (((EXISTS ( SELECT 1
   FROM purchase_order_receipts r
  WHERE ((r.id = purchase_order_receipt_lines.receipt_id) AND (r.user_id = ( SELECT public.current_business_id() AS uid)))))));
ALTER POLICY "Users can view own purchase order receipts" ON public.purchase_order_receipts
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can delete own active purchase orders" ON public.purchase_orders
  USING ((((( SELECT public.current_business_id() AS uid) = user_id) AND (status = ANY (ARRAY['draft'::text, 'ordered'::text, 'cancelled'::text])))) AND (SELECT public.can_delete()));
ALTER POLICY "Users can create own purchase orders" ON public.purchase_orders
  WITH CHECK ((((( SELECT public.current_business_id() AS uid) = user_id) AND (status = ANY (ARRAY['draft'::text, 'ordered'::text])))) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own purchase orders" ON public.purchase_orders
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update own purchase orders" ON public.purchase_orders
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can delete own sales order lines" ON public.sales_order_lines
  USING (((EXISTS ( SELECT 1
   FROM sales_orders o
  WHERE ((o.id = sales_order_lines.sales_order_id) AND (o.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can create own sales order lines" ON public.sales_order_lines
  WITH CHECK (((EXISTS ( SELECT 1
   FROM sales_orders o
  WHERE ((o.id = sales_order_lines.sales_order_id) AND (o.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own sales order lines" ON public.sales_order_lines
  USING (((EXISTS ( SELECT 1
   FROM sales_orders o
  WHERE ((o.id = sales_order_lines.sales_order_id) AND (o.user_id = ( SELECT public.current_business_id() AS uid)))))));
ALTER POLICY "Users can update own sales order lines" ON public.sales_order_lines
  USING (((EXISTS ( SELECT 1
   FROM sales_orders o
  WHERE ((o.id = sales_order_lines.sales_order_id) AND (o.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_write()))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM sales_orders o
  WHERE ((o.id = sales_order_lines.sales_order_id) AND (o.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can delete own invoice payments" ON public.sales_order_payments
  USING (((EXISTS ( SELECT 1
   FROM sales_orders o
  WHERE ((o.id = sales_order_payments.sales_order_id) AND (o.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_delete()));
ALTER POLICY "Users can add own invoice payments" ON public.sales_order_payments
  WITH CHECK (((EXISTS ( SELECT 1
   FROM sales_orders o
  WHERE ((o.id = sales_order_payments.sales_order_id) AND (o.user_id = ( SELECT public.current_business_id() AS uid)))))) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own invoice payments" ON public.sales_order_payments
  USING (((EXISTS ( SELECT 1
   FROM sales_orders o
  WHERE ((o.id = sales_order_payments.sales_order_id) AND (o.user_id = ( SELECT public.current_business_id() AS uid)))))));
ALTER POLICY "Users can delete own sales orders" ON public.sales_orders
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_delete()));
ALTER POLICY "Users can create own sales orders" ON public.sales_orders
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own sales orders" ON public.sales_orders
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update own sales orders" ON public.sales_orders
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can insert their own stock movements" ON public.stock_movements
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view their own stock movements" ON public.stock_movements
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can delete own suppliers" ON public.suppliers
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_delete()));
ALTER POLICY "Users can create own suppliers" ON public.suppliers
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view own suppliers" ON public.suppliers
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));
ALTER POLICY "Users can update own suppliers" ON public.suppliers
  USING (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()))
  WITH CHECK (((( SELECT public.current_business_id() AS uid) = user_id)) AND (SELECT public.can_write()));
ALTER POLICY "Users can view their own subscription" ON public.user_subscriptions
  USING (((( SELECT public.current_business_id() AS uid) = user_id)));

-- The three FOR ALL policies above now demand can_write() for everything,
-- which would hide those rows from view-only members. A separate read policy
-- gives SELECT back; DELETE/UPDATE still go through the FOR ALL one.
create policy asset_events_business_read on public.asset_events
  for select to authenticated using ((select public.current_business_id()) = user_id);
create policy inventory_assets_business_read on public.inventory_assets
  for select to authenticated using ((select public.current_business_id()) = user_id);
create policy inventory_depot_transfers_business_read on public.inventory_depot_transfers
  for select to authenticated using ((select public.current_business_id()) = user_id);

-- ---------------------------------------------------------------- 4. functions
-- Every function that compared against auth.uid() compares against the
-- business instead. The five SECURITY DEFINER write RPCs bypass RLS, so they
-- also get an explicit "view-only members may not" guard, inserted right after
-- the line that reads the caller's id. Done by text replacement on the live
-- definitions so nothing else in these long functions can drift.
do $$
declare
  fn text;
  def text;
  guard constant text :=
    ' if not public.can_write() then raise exception ''Your role can only view this business.'' using errcode = ''42501''; end if;';
begin
  foreach fn in array array[
    'public.complete_pick_list(bigint, boolean)',
    'public.enforce_pick_list_active_limit()',
    'public.enforce_plan_item_limit()',
    'public.get_asset_assignee_suggestions(text)',
    'public.guard_pick_list_item_delete()',
    'public.guard_purchase_order_line_delete()',
    'public.issue_sales_order(bigint)',
    'public.normalize_and_validate_pick_list_item()',
    'public.normalize_and_validate_purchase_order_line()',
    'public.normalize_purchase_order()',
    'public.receive_purchase_order_lines(bigint, jsonb, text, boolean)',
    'public.record_asset_event(bigint, text, text, text, text, text, text)',
    'public.record_stock_movement(bigint, text, integer, text)',
    'public.transfer_inventory_item_to_depot(bigint, bigint, text, text)',
    'public.validate_purchase_order_payment()',
    'public.validate_sales_order_line_owner()',
    'public.validate_sales_order_payment()'
  ]
  loop
    def := pg_get_functiondef(fn::regprocedure);
    def := replace(def, 'authenticated_user_id := auth.uid();',
                        'authenticated_user_id := public.current_business_id();' || guard);
    def := replace(def, 'user_id_var := auth.uid();',
                        'user_id_var := public.current_business_id();' || guard);
    def := replace(def, 'auth.uid()', 'public.current_business_id()');
    execute def;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- 5. storage
alter policy "Users can upload own product images" on storage.objects
  with check ((bucket_id = 'products') and ((storage.foldername(name))[1] = ((select public.current_business_id()))::text) and (select public.can_write()));
alter policy "Users can update own product images" on storage.objects
  using ((bucket_id = 'products') and ((storage.foldername(name))[1] = ((select public.current_business_id()))::text) and (select public.can_write()));
alter policy "Users can delete own product images" on storage.objects
  using ((bucket_id = 'products') and ((storage.foldername(name))[1] = ((select public.current_business_id()))::text) and (select public.can_write()));
alter policy "Users can upload own PO attachments" on storage.objects
  with check ((bucket_id = 'po-attachments') and ((storage.foldername(name))[1] = ((select public.current_business_id()))::text) and (select public.can_write()));
alter policy "Users can read own PO attachments" on storage.objects
  using ((bucket_id = 'po-attachments') and ((storage.foldername(name))[1] = ((select public.current_business_id()))::text));
alter policy "Users can delete own PO attachments" on storage.objects
  using ((bucket_id = 'po-attachments') and ((storage.foldername(name))[1] = ((select public.current_business_id()))::text) and (select public.can_write()));
alter policy "Users can upload own business logos" on storage.objects
  with check ((bucket_id = 'business-logos') and ((storage.foldername(name))[1] = ((select public.current_business_id()))::text) and (select public.can_manage_business()));
alter policy "Users can update own business logos" on storage.objects
  using ((bucket_id = 'business-logos') and ((storage.foldername(name))[1] = ((select public.current_business_id()))::text) and (select public.can_manage_business()));
alter policy "Users can delete own business logos" on storage.objects
  using ((bucket_id = 'business-logos') and ((storage.foldername(name))[1] = ((select public.current_business_id()))::text) and (select public.can_manage_business()));

-- ---------------------------------------------------------------- 6. "done by"
-- Who actually pressed the button. Existing rows stay null (they were all the
-- owner). auth.uid() reads the request's token, so the default is right even
-- inside SECURITY DEFINER functions.
alter table public.inventory_history
  add column if not exists actor_id uuid null default auth.uid() references auth.users (id) on delete set null;
alter table public.stock_movements
  add column if not exists actor_id uuid null default auth.uid() references auth.users (id) on delete set null;
alter table public.sales_orders
  add column if not exists actor_id uuid null default auth.uid() references auth.users (id) on delete set null;
alter table public.purchase_orders
  add column if not exists actor_id uuid null default auth.uid() references auth.users (id) on delete set null;

-- ---------------------------------------------------------------- 7. RPCs
-- Seats per plan (extra people besides the owner). Change here only.
create or replace function public.team_seat_limit(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(us.status, ''))) <> 'active' then 1
    when lower(btrim(us.plan)) = 'pro' then 10
    when lower(btrim(us.plan)) = 'standard' then 3
    else 1
  end
  from (select 1) one
  left join public.user_subscriptions us on us.user_id = p_owner;
$$;

-- Everything the app needs on load: which business, which role, and any
-- invitations waiting for this person's email.
create or replace function public.my_business()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_business uuid;
  v_email text := lower((auth.jwt()) ->> 'email');
begin
  if v_uid is null then
    return null;
  end if;

  v_business := public.current_business_id();

  return jsonb_build_object(
    'user_id', v_uid,
    'business_id', v_business,
    'role', public.current_business_role(),
    'business_name', (select bs.business_name from public.business_settings bs where bs.user_id = v_business limit 1),
    'seat_limit', public.team_seat_limit(v_business),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bm.id,
        'role', bm.role,
        'business_name', coalesce(
          (select bs.business_name from public.business_settings bs where bs.user_id = bm.owner_id limit 1),
          'A SydIN business')
      ) order by bm.created_at)
      from public.business_members bm
      where bm.status = 'invited' and bm.email = v_email and bm.owner_id <> v_uid
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_team()
returns table (
  id bigint, email text, role text, status text,
  is_owner boolean, is_you boolean, created_at timestamptz, accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business uuid := public.current_business_id();
begin
  if v_business is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not public.can_manage_business() then
    raise exception 'Only the owner or an admin can see the team.' using errcode = '42501';
  end if;

  return query
    select null::bigint, lower(u.email::text), 'owner'::text, 'active'::text,
           true, u.id = auth.uid(), u.created_at, u.created_at
      from auth.users u
     where u.id = v_business
    union all
    select bm.id, bm.email, bm.role, bm.status,
           false, bm.member_id is not distinct from auth.uid(), bm.created_at, bm.accepted_at
      from public.business_members bm
     where bm.owner_id = v_business
    order by 5 desc, 7;
end;
$$;

create or replace function public.invite_member(p_email text, p_role text)
returns public.business_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid := public.current_business_id();
  v_role text := public.current_business_role();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_used integer;
  v_limit integer;
  v_row public.business_members;
begin
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'Only the owner or an admin can invite people.' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'staff', 'viewer') then
    raise exception 'Choose Admin, Staff or View only.' using errcode = '22023';
  end if;
  if p_role = 'admin' and v_role <> 'owner' then
    raise exception 'Only the owner can add admins.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That email address does not look right.' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users u where u.id = v_business and lower(u.email) = v_email) then
    raise exception 'That is the owner''s own email.' using errcode = '22023';
  end if;

  select * into v_row from public.business_members
   where owner_id = v_business and email = v_email
   for update;

  if found then
    if v_row.role = 'admin' and v_role <> 'owner' then
      raise exception 'Only the owner can change an admin.' using errcode = '42501';
    end if;
    update public.business_members set role = p_role
     where id = v_row.id returning * into v_row;
    return v_row;
  end if;

  select count(*) into v_used from public.business_members where owner_id = v_business;
  v_limit := public.team_seat_limit(v_business);
  if v_used >= v_limit then
    raise exception 'Your plan includes % team seat(s). Upgrade to add more people.', v_limit
      using errcode = 'P0001';
  end if;

  insert into public.business_members (owner_id, email, role, invited_by)
  values (v_business, v_email, p_role, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.change_member_role(p_member_row bigint, p_role text)
returns public.business_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid := public.current_business_id();
  v_role text := public.current_business_role();
  v_row public.business_members;
begin
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'Only the owner or an admin can change roles.' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'staff', 'viewer') then
    raise exception 'Choose Admin, Staff or View only.' using errcode = '22023';
  end if;
  select * into v_row from public.business_members
   where id = p_member_row and owner_id = v_business for update;
  if not found then
    raise exception 'Team member not found.' using errcode = '42501';
  end if;
  if (v_row.role = 'admin' or p_role = 'admin') and v_role <> 'owner' then
    raise exception 'Only the owner can add or change admins.' using errcode = '42501';
  end if;
  update public.business_members set role = p_role where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.remove_member(p_member_row bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid := public.current_business_id();
  v_role text := public.current_business_role();
  v_row public.business_members;
begin
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'Only the owner or an admin can remove people.' using errcode = '42501';
  end if;
  select * into v_row from public.business_members
   where id = p_member_row and owner_id = v_business for update;
  if not found then
    raise exception 'Team member not found.' using errcode = '42501';
  end if;
  if v_row.role = 'admin' and v_role <> 'owner' then
    raise exception 'Only the owner can remove an admin.' using errcode = '42501';
  end if;
  delete from public.business_members where id = v_row.id;
end;
$$;

create or replace function public.accept_invite(p_member_row bigint)
returns public.business_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower((auth.jwt()) ->> 'email');
  v_row public.business_members;
begin
  if v_uid is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if exists (select 1 from public.business_members where member_id = v_uid and status = 'active') then
    raise exception 'Leave your current business before joining another.' using errcode = '55000';
  end if;
  if exists (select 1 from public.business_members where owner_id = v_uid) then
    raise exception 'You have your own team. Remove its members before joining another business.'
      using errcode = '55000';
  end if;
  select * into v_row from public.business_members
   where id = p_member_row and status = 'invited' and email = v_email for update;
  if not found then
    raise exception 'This invitation is no longer available.' using errcode = '42501';
  end if;
  update public.business_members
     set member_id = v_uid, status = 'active', accepted_at = now()
   where id = v_row.id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.decline_invite(p_member_row bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.business_members
   where id = p_member_row and status = 'invited'
     and email = lower((auth.jwt()) ->> 'email');
$$;

create or replace function public.leave_business()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.business_members
   where member_id = auth.uid() and status = 'active';
$$;

-- Nothing here is for signed-out visitors (Phase 16 rule).
revoke all on function
  public.current_business_id(), public.current_business_role(), public.can_write(),
  public.can_delete(), public.can_manage_business(), public.team_seat_limit(uuid),
  public.my_business(), public.list_team(), public.invite_member(text, text),
  public.change_member_role(bigint, text), public.remove_member(bigint),
  public.accept_invite(bigint), public.decline_invite(bigint), public.leave_business()
  from public, anon;
grant execute on function
  public.current_business_id(), public.current_business_role(), public.can_write(),
  public.can_delete(), public.can_manage_business(),
  public.my_business(), public.list_team(), public.invite_member(text, text),
  public.change_member_role(bigint, text), public.remove_member(bigint),
  public.accept_invite(bigint), public.decline_invite(bigint), public.leave_business()
  to authenticated;

commit;

-- ============================================================== ROLLBACK
-- Run only to undo this file. Functions first, then policies.
--
-- begin;
-- do $$
-- declare fn text; def text;
--   guard constant text :=
--     ' if not public.can_write() then raise exception ''Your role can only view this business.'' using errcode = ''42501''; end if;';
-- begin
--   foreach fn in array array[ ...the same 17 signatures as section 4... ] loop
--     def := pg_get_functiondef(fn::regprocedure);
--     def := replace(def, guard, '');
--     def := replace(def, 'public.current_business_id()', 'auth.uid()');
--     execute def;
--   end loop;
-- end $$;
-- Policies: re-run section 3 with "public.current_business_id()" -> "auth.uid()"
-- and every " AND (SELECT public.can_write())", " AND (SELECT public.can_delete())",
-- " AND (SELECT public.can_manage_business())" removed; drop the three
-- *_business_read policies; storage: first folder = auth.uid(), role clauses
-- dropped; then drop the RPCs, the helpers and public.business_members.
-- commit;
