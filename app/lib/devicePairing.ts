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
}

/**
 * Generate a random 6-digit pairing code
 */
function generatePairingCode(): string {
  return Math.random().toString().slice(2, 8).padStart(6, "0");
}

/**
 * Create a new device pairing for cross-device barcode scanning
 * Laptop initiates the pairing, phone joins by entering the code
 */
export async function createDevicePairing(params: {
  userId: string;
  laptopDeviceId: string;
}): Promise<DevicePairing | null> {
  const pairingCode = generatePairingCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  const { data, error } = await supabase
    .from("device_pairings")
    .insert([
      {
        user_id: params.userId,
        laptop_device_id: params.laptopDeviceId,
        pairing_code: pairingCode,
        status: "waiting",
        expires_at: expiresAt.toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating device pairing:", error);
    return null;
  }

  return data;
}

/**
 * Join a pairing from phone by entering the 6-digit code
 */
export async function joinDevicePairing(params: {
  userId: string;
  pairingCode: string;
  phoneDeviceId: string;
}): Promise<DevicePairing | null> {
  // Verify pairing exists, belongs to user, and hasn't expired
  const { data: pairing, error: fetchError } = await supabase
    .from("device_pairings")
    .select("*")
    .eq("pairing_code", params.pairingCode)
    .eq("user_id", params.userId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (fetchError || !pairing) {
    console.error("Invalid or expired pairing code");
    return null;
  }

  // Update pairing with phone device ID and mark as paired
  const { data, error } = await supabase
    .from("device_pairings")
    .update({
      phone_device_id: params.phoneDeviceId,
      status: "paired",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pairing.id)
    .select()
    .single();

  if (error) {
    console.error("Error joining pairing:", error);
    return null;
  }

  return data;
}

/**
 * Get active pairing for a laptop device
 */
export async function getActivePairing(
  userId: string,
  laptopDeviceId: string
): Promise<DevicePairing | null> {
  const { data, error } = await supabase
    .from("device_pairings")
    .select("*")
    .eq("user_id", userId)
    .eq("laptop_device_id", laptopDeviceId)
    .in("status", ["waiting", "paired"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Send a barcode from phone to laptop via pairing
 */
export async function sendBarcodeToLaptop(params: {
  pairingId: number;
  barcodeData: string;
  barcodeType?: string;
}): Promise<boolean> {
  const { error } = await supabase
    .from("pairing_barcodes")
    .insert([
      {
        pairing_id: params.pairingId,
        barcode_data: params.barcodeData,
        barcode_type: params.barcodeType || null,
        processed: false,
      },
    ]);

  if (error) {
    console.error("Error sending barcode:", error);
    return false;
  }

  return true;
}

/**
 * Get unprocessed barcodes for a pairing
 */
export async function getUnprocessedBarcodes(
  pairingId: number
): Promise<Array<{ id: number; barcode_data: string; barcode_type: string | null }>> {
  const { data, error } = await supabase
    .from("pairing_barcodes")
    .select("id, barcode_data, barcode_type")
    .eq("pairing_id", pairingId)
    .eq("processed", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching barcodes:", error);
    return [];
  }

  return data || [];
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
 * Terminate a pairing
 */
export async function terminatePairing(pairingId: number): Promise<boolean> {
  const { error } = await supabase
    .from("device_pairings")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pairingId);

  if (error) {
    console.error("Error terminating pairing:", error);
    return false;
  }

  return true;
}
