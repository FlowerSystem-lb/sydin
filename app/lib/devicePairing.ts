import { supabase } from "@/app/lib/supabase";

export interface DevicePairing {
  id: number;
  user_id: string;
  laptop_device_id: string;
  pairing_code: string;
  phone_device_id: string | null;
  status: "waiting" | "paired" | "expired";
  expires_at: string;
  created_at: string;
  updated_at: string;
  /** Phase 38: the phone links with this token from the QR, no login. */
  pair_token?: string | null;
  device_label?: string | null;
  mode?: string | null;
  linked_at?: string | null;
  last_seen_at?: string | null;
}

/** Never select phone_secret on the laptop: it is the phone's key. */
const PAIRING_COLUMNS =
  "id, user_id, laptop_device_id, pairing_code, phone_device_id, status, expires_at, created_at, updated_at, pair_token, device_label, mode, linked_at, last_seen_at";

export interface PairedBarcode {
  id: number;
  barcode_data: string;
  barcode_type: string | null;
  item_id?: number | null;
  matched_by?: string | null;
}

/** A random 6-digit code from the browser's crypto source. */
function generatePairingCode(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

/** 32 random bytes, url-safe: the QR link's only secret. */
function generatePairToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The laptop starts a pairing. The phone links by opening /pair/<pair_token>
 * (the QR) or typing the 6-digit code on /pair.
 */
export async function createDevicePairing(params: {
  userId: string;
  laptopDeviceId: string;
}): Promise<DevicePairing | null> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes to link

  // pairing_code is unique across all pairings ever made, so a rare clash
  // with an old row just takes another draw.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabase
      .from("device_pairings")
      .insert([
        {
          user_id: params.userId,
          laptop_device_id: params.laptopDeviceId,
          pairing_code: generatePairingCode(),
          pair_token: generatePairToken(),
          status: "waiting",
          expires_at: expiresAt.toISOString(),
        },
      ])
      .select(PAIRING_COLUMNS)
      .single();

    if (!error) return data as DevicePairing;
    if (error.code !== "23505") {
      console.error("Error creating device pairing:", error);
      return null;
    }
  }

  return null;
}

/**
 * The newest live pairing for this laptop. Pairings from before phase 38 have
 * no token, so their QR could never link a logged-out phone: skip them.
 */
export async function getActivePairing(
  userId: string,
  laptopDeviceId: string
): Promise<DevicePairing | null> {
  const { data, error } = await supabase
    .from("device_pairings")
    .select(PAIRING_COLUMNS)
    .eq("user_id", userId)
    .eq("laptop_device_id", laptopDeviceId)
    .in("status", ["waiting", "paired"])
    .not("pair_token", "is", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as DevicePairing | null;
}

export async function getPairing(pairingId: number): Promise<DevicePairing | null> {
  const { data, error } = await supabase
    .from("device_pairings")
    .select(PAIRING_COLUMNS)
    .eq("id", pairingId)
    .maybeSingle();

  if (error) return null;
  return data as DevicePairing | null;
}

/** The laptop is the source of truth for the mode; the phone reads it on ping. */
export async function setPairingMode(pairingId: number, mode: string) {
  await supabase.from("device_pairings").update({ mode }).eq("id", pairingId);
}

/** The laptop's "Vibrate phone" switch; the phone reads it on its heartbeat. */
export async function setPairingVibrate(pairingId: number, vibrate: boolean) {
  await supabase.from("device_pairings").update({ phone_vibrate: vibrate }).eq("id", pairingId);
}

/**
 * Get unprocessed barcodes for a pairing
 */
export async function getUnprocessedBarcodes(pairingId: number): Promise<PairedBarcode[]> {
  const { data, error } = await supabase
    .from("pairing_barcodes")
    .select("id, barcode_data, barcode_type, item_id, matched_by")
    .eq("pairing_id", pairingId)
    .eq("processed", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching barcodes:", error);
    return [];
  }

  return (data || []) as PairedBarcode[];
}

/**
 * Mark barcodes as processed
 */
export async function markBarcodesProcessed(barcodeIds: number[]): Promise<boolean> {
  if (barcodeIds.length === 0) return true;

  const { error } = await supabase
    .from("pairing_barcodes")
    .update({ processed: true })
    .in("id", barcodeIds);

  if (error) {
    console.error("Error marking barcodes processed:", error);
    return false;
  }

  return true;
}

/**
 * Disconnect from the laptop: the phone's next post gets "closed".
 */
export async function terminatePairing(pairingId: number): Promise<boolean> {
  const { error } = await supabase
    .from("device_pairings")
    .update({
      status: "expired",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", pairingId);

  if (error) {
    console.error("Error terminating pairing:", error);
    return false;
  }

  return true;
}

/* ---- The phone side (no login). Each call goes through one of the
   phase-38 SECURITY DEFINER functions, scoped to a single pairing. ---- */

export type PhoneLinkError = "invalid" | "already_linked" | "too_many" | "closed" | "slow_down" | "network";

export interface PhoneClaim {
  secret: string;
  mode: string;
  businessName: string;
}

export interface PhoneScanResult {
  item: { name: string; code: string | null; quantity: number; unit: string | null } | null;
  matchedBy?: string | null;
}

type RpcBody = Record<string, unknown> & { error?: PhoneLinkError };

async function callPhoneRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { error: "network" as PhoneLinkError };
  return (data || {}) as RpcBody;
}

export async function claimPhoneLink(params: {
  token?: string;
  code?: string;
  deviceLabel: string;
}): Promise<{ ok: true; claim: PhoneClaim } | { ok: false; error: PhoneLinkError }> {
  const body = await callPhoneRpc("scanner_phone_claim", {
    p_token: params.token || null,
    p_code: params.code || null,
    p_device_label: params.deviceLabel,
  });
  if (body.error || !body.secret) return { ok: false, error: body.error || "invalid" };
  return {
    ok: true,
    claim: {
      secret: String(body.secret),
      mode: String(body.mode || "lookup"),
      businessName: String(body.business_name || "your business"),
    },
  };
}

export async function postPhoneScan(
  secret: string,
  raw: string
): Promise<{ ok: true; result: PhoneScanResult } | { ok: false; error: PhoneLinkError }> {
  const body = await callPhoneRpc("scanner_phone_post", { p_secret: secret, p_raw: raw });
  if (body.error) return { ok: false, error: body.error };
  return {
    ok: true,
    result: {
      item: (body.item as PhoneScanResult["item"]) || null,
      matchedBy: (body.matched_by as string) || null,
    },
  };
}

export async function pingPhoneLink(
  secret: string,
  mode?: string
): Promise<{ ok: true; mode: string; vibrate: boolean } | { ok: false; error: PhoneLinkError }> {
  const body = await callPhoneRpc("scanner_phone_ping", { p_secret: secret, p_mode: mode || null });
  if (body.error) return { ok: false, error: body.error };
  return { ok: true, mode: String(body.mode || "lookup"), vibrate: body.vibrate !== false };
}

export async function leavePhoneLink(secret: string) {
  await supabase.rpc("scanner_phone_leave", { p_secret: secret });
}

/** Where the QR sends the phone. On localhost the phone cannot reach this
 *  machine (and camera needs HTTPS), so it goes to the live site, which
 *  shares the same database. */
export function getPairingBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (typeof window === "undefined") return "https://www.sydin.site";
  const { hostname, origin } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")
    ? "https://www.sydin.site"
    : origin;
}
