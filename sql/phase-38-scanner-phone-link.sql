-- Phase 38: phone as a wireless scanner with no login on the phone
-- (8 Oct 2026, Sayed's Scanner redesign).
--
-- Builds on the phase-12 pairing tables instead of adding new ones:
--   device_pairings  = the scan session (waiting -> paired -> expired)
--   pairing_barcodes = every code the phone sent
--
-- The laptop (signed in) creates the pairing as before, now with a long random
-- `pair_token` for the QR link. The phone is anonymous: it can only call the
-- four SECURITY DEFINER functions below, and each one is scoped to a single
-- pairing. Claiming is single-use and swaps the token for a fresh
-- `phone_secret`, so a photographed QR is useless once the phone has linked.
-- The phone never reads tables directly and only ever receives the name,
-- code and quantity of the item it just scanned.

alter table public.device_pairings
  add column if not exists pair_token text,
  add column if not exists phone_secret text,
  add column if not exists device_label text,
  add column if not exists mode text not null default 'lookup',
  add column if not exists linked_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists closed_at timestamptz;

create unique index if not exists device_pairings_pair_token_unique
  on public.device_pairings (pair_token) where pair_token is not null;
create unique index if not exists device_pairings_phone_secret_unique
  on public.device_pairings (phone_secret) where phone_secret is not null;

alter table public.pairing_barcodes
  add column if not exists item_id bigint,
  add column if not exists matched_by text;

create index if not exists pairing_barcodes_pairing_created
  on public.pairing_barcodes (pairing_id, created_at);

-- Failed claims by typed code, for rate limiting a 6-digit guess. RLS on with
-- no policies: only the definer functions below can read or write it.
create table if not exists public.scanner_pair_attempts (
  id bigint generated always as identity primary key,
  ip text not null default '',
  at timestamptz not null default now()
);
alter table public.scanner_pair_attempts enable row level security;
create index if not exists scanner_pair_attempts_at on public.scanner_pair_attempts (at);

create or replace function public.scanner_request_ip()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    split_part(
      coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
      ',', 1),
    '')
$$;

-- ---------------------------------------------------------------------------
-- Claim: by the QR token, or by the 6-digit code typed on /pair.
-- ---------------------------------------------------------------------------
create or replace function public.scanner_phone_claim(
  p_token text default null,
  p_code text default null,
  p_device_label text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pairing public.device_pairings;
  v_ip text := public.scanner_request_ip();
  v_secret text;
  v_business text;
begin
  if coalesce(p_token, '') = '' and coalesce(p_code, '') = '' then
    return json_build_object('error', 'invalid');
  end if;

  -- A typed code is only 6 digits, so guesses are throttled: 10 failures per
  -- address per 10 minutes, and 300 failures a minute across everyone.
  if coalesce(p_token, '') = '' then
    if (select count(*) from public.scanner_pair_attempts
          where ip = v_ip and at > now() - interval '10 minutes') >= 10
       or (select count(*) from public.scanner_pair_attempts
          where at > now() - interval '1 minute') >= 300 then
      return json_build_object('error', 'too_many');
    end if;
  end if;

  if coalesce(p_token, '') <> '' then
    select * into v_pairing from public.device_pairings
     where pair_token = p_token
     for update;
  else
    select * into v_pairing from public.device_pairings
     where pairing_code = regexp_replace(p_code, '\D', '', 'g')
       and pair_token is not null
     for update;
  end if;

  if v_pairing.id is null
     or v_pairing.status = 'expired'
     or (v_pairing.status = 'waiting' and v_pairing.expires_at < now()) then
    if coalesce(p_token, '') = '' then
      insert into public.scanner_pair_attempts (ip) values (v_ip);
      delete from public.scanner_pair_attempts where at < now() - interval '1 day';
    end if;
    return json_build_object('error', 'invalid');
  end if;

  if v_pairing.status = 'paired' then
    return json_build_object('error', 'already_linked');
  end if;

  v_secret := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  update public.device_pairings
     set status = 'paired',
         phone_secret = v_secret,
         device_label = left(coalesce(nullif(btrim(p_device_label), ''), 'Phone'), 60),
         phone_device_id = left(coalesce(nullif(btrim(p_device_label), ''), 'Phone'), 60),
         linked_at = now(),
         last_seen_at = now(),
         expires_at = now() + interval '8 hours',
         updated_at = now()
   where id = v_pairing.id;

  select business_name into v_business
    from public.business_settings where user_id = v_pairing.user_id limit 1;

  return json_build_object(
    'ok', true,
    'secret', v_secret,
    'mode', v_pairing.mode,
    'business_name', coalesce(nullif(btrim(v_business), ''), 'your business')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Post one scan. Resolves it the same way the laptop does (SydIN QR link,
-- then exact SKU, barcode, item code, then SKU ignoring case) and returns the
-- smallest possible summary to the phone.
-- ---------------------------------------------------------------------------
create or replace function public.scanner_phone_post(p_secret text, p_raw text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pairing public.device_pairings;
  v_raw text := btrim(coalesce(p_raw, ''));
  v_public text;
  v_item public.inventory;
  v_matched text;
  v_count int;
begin
  select * into v_pairing from public.device_pairings
   where phone_secret = p_secret and coalesce(p_secret, '') <> '';

  if v_pairing.id is null or v_pairing.status <> 'paired' or v_pairing.expires_at < now() then
    return json_build_object('error', 'closed');
  end if;

  if v_raw = '' or length(v_raw) > 512 then
    return json_build_object('error', 'invalid');
  end if;

  if (select count(*) from public.pairing_barcodes
        where pairing_id = v_pairing.id and created_at > now() - interval '1 second') >= 5 then
    return json_build_object('error', 'slow_down');
  end if;

  v_public := substring(v_raw from '(?i)item/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})');
  if v_public is null and v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_public := v_raw;
  end if;

  if v_public is not null then
    select * into v_item from public.inventory
     where user_id = v_pairing.user_id and public_id = v_public::uuid limit 1;
    if v_item.id is not null then v_matched := 'public_id'; end if;
  end if;

  if v_item.id is null then
    select count(*) into v_count from public.inventory
     where user_id = v_pairing.user_id and btrim(sku) = v_raw;
    if v_count = 1 then
      select * into v_item from public.inventory where user_id = v_pairing.user_id and btrim(sku) = v_raw;
      v_matched := 'sku';
    end if;
  end if;

  if v_item.id is null then
    select count(*) into v_count from public.inventory
     where user_id = v_pairing.user_id and btrim(barcode) = v_raw;
    if v_count = 1 then
      select * into v_item from public.inventory where user_id = v_pairing.user_id and btrim(barcode) = v_raw;
      v_matched := 'barcode';
    end if;
  end if;

  if v_item.id is null then
    select count(*) into v_count from public.inventory
     where user_id = v_pairing.user_id and lower(btrim(item_code)) = lower(v_raw);
    if v_count = 1 then
      select * into v_item from public.inventory where user_id = v_pairing.user_id and lower(btrim(item_code)) = lower(v_raw);
      v_matched := 'item_code';
    end if;
  end if;

  if v_item.id is null then
    select count(*) into v_count from public.inventory
     where user_id = v_pairing.user_id and lower(btrim(sku)) = lower(v_raw);
    if v_count = 1 then
      select * into v_item from public.inventory where user_id = v_pairing.user_id and lower(btrim(sku)) = lower(v_raw);
      v_matched := 'sku';
    end if;
  end if;

  insert into public.pairing_barcodes (pairing_id, barcode_data, processed, item_id, matched_by)
  values (v_pairing.id, v_raw, false, v_item.id, v_matched);

  update public.device_pairings
     set last_seen_at = now(), expires_at = now() + interval '8 hours'
   where id = v_pairing.id;

  if v_item.id is null then
    return json_build_object('ok', true, 'item', null);
  end if;

  return json_build_object(
    'ok', true,
    'matched_by', v_matched,
    'item', json_build_object(
      'name', v_item.name,
      'code', coalesce(nullif(btrim(v_item.item_code), ''), nullif(btrim(v_item.sku), '')),
      'quantity', v_item.quantity,
      'unit', coalesce(nullif(btrim(v_item.custom_unit_label), ''), v_item.unit_type)
    )
  );
end;
$$;

-- Heartbeat every ~10s. The phone may also change the mode; the laptop reads
-- it from the pairing row, so both stay in sync.
create or replace function public.scanner_phone_ping(p_secret text, p_mode text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pairing public.device_pairings;
begin
  select * into v_pairing from public.device_pairings
   where phone_secret = p_secret and coalesce(p_secret, '') <> '';

  if v_pairing.id is null or v_pairing.status <> 'paired' or v_pairing.expires_at < now() then
    return json_build_object('error', 'closed');
  end if;

  update public.device_pairings
     set last_seen_at = now(),
         mode = case when p_mode in ('lookup','receive','issue','count','transfer','assign','repair','return')
                     then p_mode else mode end
   where id = v_pairing.id
   returning * into v_pairing;

  return json_build_object('ok', true, 'mode', v_pairing.mode);
end;
$$;

create or replace function public.scanner_phone_leave(p_secret text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.device_pairings
     set status = 'expired', closed_at = now(), updated_at = now()
   where phone_secret = p_secret and coalesce(p_secret, '') <> '' and status = 'paired';
$$;

revoke all on function public.scanner_request_ip() from public;
revoke all on function public.scanner_phone_claim(text, text, text) from public;
revoke all on function public.scanner_phone_post(text, text) from public;
revoke all on function public.scanner_phone_ping(text, text) from public;
revoke all on function public.scanner_phone_leave(text) from public;
grant execute on function public.scanner_phone_claim(text, text, text) to anon, authenticated;
grant execute on function public.scanner_phone_post(text, text) to anon, authenticated;
grant execute on function public.scanner_phone_ping(text, text) to anon, authenticated;
grant execute on function public.scanner_phone_leave(text) to anon, authenticated;

-- 38b (same day): the laptop's "Vibrate phone" switch reaches the phone
-- through the heartbeat.
alter table public.device_pairings
  add column if not exists phone_vibrate boolean not null default true;

create or replace function public.scanner_phone_ping(p_secret text, p_mode text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pairing public.device_pairings;
begin
  select * into v_pairing from public.device_pairings
   where phone_secret = p_secret and coalesce(p_secret, '') <> '';

  if v_pairing.id is null or v_pairing.status <> 'paired' or v_pairing.expires_at < now() then
    return json_build_object('error', 'closed');
  end if;

  update public.device_pairings
     set last_seen_at = now(),
         mode = case when p_mode in ('lookup','receive','issue','count','transfer','assign','repair','return')
                     then p_mode else mode end
   where id = v_pairing.id
   returning * into v_pairing;

  return json_build_object('ok', true, 'mode', v_pairing.mode, 'vibrate', v_pairing.phone_vibrate);
end;
$$;
