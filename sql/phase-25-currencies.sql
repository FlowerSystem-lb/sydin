-- SydIN Phase 25: Currencies that convert
--
-- Sayed switched Settings from USD to LBP and every price kept its number
-- with a new label: "LBP 50.00" for a USD 50 item. The currency setting was
-- only ever a label. This phase makes it real.
--
--   * base_currency  -- the currency every stored amount is in (item prices,
--                       stock values, order lines). It does not change when
--                       the display currency changes.
--   * currency_code  -- (existing) the currency the app SHOWS. Amounts are
--                       converted from base to this on display.
--   * exchange_rates -- live rates, 1 USD = x, as {"LBP": 89500, "EUR": 0.92}
--                       (the shape every free rate feed uses).
--   * manual_rates   -- the same shape, typed by the business, wins over live.
--   * rates_updated_at
--
--   * sales_orders.exchange_rate / purchase_orders.exchange_rate -- documents
--     already carry currency_code; this records how many units of the
--     document's currency one unit of base was worth when it was made, so
--     totals across documents in different currencies can be added up in
--     base. 1 when the document is in base.
--
-- Backfill: base_currency = the currency the account had, which is the one
-- its prices were typed in. One exception, done by hand: Sayed's own account
-- flipped to LBP today with USD prices, so its base is USD.
--
-- Run manually in the Supabase SQL editor after reviewing. Safe to re-run.

begin;

alter table public.business_settings
  add column if not exists base_currency text null,
  add column if not exists exchange_rates jsonb null,
  add column if not exists manual_rates jsonb null,
  add column if not exists rates_updated_at timestamptz null;

update public.business_settings
set base_currency = upper(coalesce(nullif(btrim(currency_code), ''), 'USD'))
where base_currency is null;

-- The one account whose display was changed before conversion existed.
update public.business_settings
set base_currency = 'USD'
where user_id = '06042445-cbb3-45e6-a0c5-2f5dbb2c3b58'
  and base_currency = 'LBP';

alter table public.sales_orders
  add column if not exists exchange_rate numeric(18, 6) not null default 1;
alter table public.purchase_orders
  add column if not exists exchange_rate numeric(18, 6) not null default 1;

alter table public.sales_orders
  drop constraint if exists sales_orders_exchange_rate_positive;
alter table public.sales_orders
  add constraint sales_orders_exchange_rate_positive check (exchange_rate > 0);
alter table public.purchase_orders
  drop constraint if exists purchase_orders_exchange_rate_positive;
alter table public.purchase_orders
  add constraint purchase_orders_exchange_rate_positive check (exchange_rate > 0);

comment on column public.business_settings.base_currency is
  'Currency all stored amounts are in. Never changed by the display currency.';
comment on column public.business_settings.exchange_rates is
  'Live rates, 1 USD = x per currency code.';
comment on column public.business_settings.manual_rates is
  'Rates typed by the business, same shape as exchange_rates; win over live.';
comment on column public.sales_orders.exchange_rate is
  'Units of the invoice currency per unit of base currency when it was made. 1 if in base.';
comment on column public.purchase_orders.exchange_rate is
  'Units of the order currency per unit of base currency when it was made. 1 if in base.';

notify pgrst, 'reload schema';

commit;
