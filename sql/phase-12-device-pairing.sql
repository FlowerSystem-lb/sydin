-- Cross-device barcode scanning: laptop and phone pairing system
-- Allows users to scan barcodes on phone and send to laptop scanner in real-time

create table public.device_pairings (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  laptop_device_id text not null,
  pairing_code text not null unique, -- 6-digit code for phone to enter
  phone_device_id text, -- Set when phone joins the pairing
  status text not null default 'waiting'::text check (status = any (array['waiting'::text, 'paired'::text, 'expired'::text])),
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Temporary table for barcode data in transit from phone to laptop
create table public.pairing_barcodes (
  id bigint primary key generated always as identity,
  pairing_id bigint not null references public.device_pairings(id) on delete cascade,
  barcode_data text not null,
  barcode_type text, -- 'ean', 'code128', 'qr', etc.
  processed boolean not null default false,
  created_at timestamp with time zone not null default now()
);

-- Indexes
create index idx_device_pairings_user_id on public.device_pairings(user_id);
create index idx_device_pairings_laptop_device_id on public.device_pairings(laptop_device_id);
create index idx_device_pairings_pairing_code on public.device_pairings(pairing_code);
create index idx_device_pairings_expires_at on public.device_pairings(expires_at);
create index idx_pairing_barcodes_pairing_id on public.pairing_barcodes(pairing_id);
create index idx_pairing_barcodes_processed on public.pairing_barcodes(processed);

-- RLS: users can only access their own pairings
alter table public.device_pairings enable row level security;
alter table public.pairing_barcodes enable row level security;

create policy "Users can view their own device pairings"
  on public.device_pairings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own device pairings"
  on public.device_pairings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own device pairings"
  on public.device_pairings for update
  using (auth.uid() = user_id);

create policy "Users can view barcodes for their pairings"
  on public.pairing_barcodes for select
  using (
    exists (
      select 1 from public.device_pairings dp
      where dp.id = pairing_barcodes.pairing_id
      and dp.user_id = auth.uid()
    )
  );

create policy "Users can insert barcodes for their pairings"
  on public.pairing_barcodes for insert
  with check (
    exists (
      select 1 from public.device_pairings dp
      where dp.id = pairing_barcodes.pairing_id
      and dp.user_id = auth.uid()
    )
  );

comment on table public.device_pairings is 'Active pairings between laptop and phone for cross-device barcode scanning';
comment on column public.device_pairings.pairing_code is '6-digit code user enters on phone to establish pairing';
comment on column public.device_pairings.status is 'waiting (phone not joined yet), paired (both devices active), expired';
comment on table public.pairing_barcodes is 'Transit table for barcodes scanned on phone, awaiting delivery to laptop';
