import { supabase } from "@/app/lib/supabase";

export interface Depot {
  id: number;
  name: string;
  code: string | null;
  notes: string | null;
  is_active: boolean;
  /** Phase 37 (6 Oct 2026). Phone is stored without the +961 prefix. */
  phone?: string | null;
  address?: string | null;
  map_url?: string | null;
  is_default?: boolean;
}

export interface DepotInput {
  name: string;
  code?: string;
  notes?: string;
  is_active?: boolean;
  phone?: string;
  address?: string;
  map_url?: string;
}

/* Every read of a depot asks for the same columns. The phase-37 fields are
   listed here once; a workspace that has not run phase 37 would fail the
   select, so `DEPOT_COLUMNS_BASE` is the fallback (see `selectDepots`). */
const DEPOT_COLUMNS = "id, name, code, notes, is_active, phone, address, map_url, is_default";
const DEPOT_COLUMNS_BASE = "id, name, code, notes, is_active";

function normalizeDepot(data: Partial<Depot>): Depot {
  return {
    id: Number(data.id),
    name: data.name?.trim() || "Unnamed depot",
    code: data.code || null,
    notes: data.notes || null,
    is_active: data.is_active !== false,
    phone: data.phone || null,
    address: data.address || null,
    map_url: data.map_url || null,
    is_default: data.is_default === true,
  };
}

/** Lebanese numbers are typed with or without +961 / a leading 0; the depot
 *  keeps the local part ("03 123 456"), the prefix is shown, not stored. */
export function normalizeDepotPhone(value?: string | null) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  return trimmed.replace(/^\+?961[\s-]*/, "").trim() || null;
}

function normalizeDepotInput(input: DepotInput) {
  return {
    name: input.name.trim(),
    code: input.code?.trim() ? input.code.trim().toUpperCase() : null,
    notes: input.notes?.trim() || null,
    is_active: input.is_active !== false,
    phone: normalizeDepotPhone(input.phone),
    address: input.address?.trim() || null,
    map_url: input.map_url?.trim() || null,
  };
}

export function formatDepotLabel(depot?: Pick<Depot, "name" | "code"> | null) {
  if (!depot) return "Unassigned";

  return depot.code ? `${depot.name} (${depot.code})` : depot.name;
}

/* ---- display helpers for the Depots page (6 Oct 2026) ---- */

export function formatDepotPhone(phone?: string | null) {
  return phone ? `+961 ${phone}` : "";
}

/** wa.me wants the international number with no "+", spaces or local 0. */
export function depotWhatsAppUrl(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `https://wa.me/961${digits}` : "";
}

export function depotTelUrl(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `tel:+961${digits}` : "";
}

/** "https://www.maps.app.goo.gl/AbC123xyz" -> "maps.app.goo.gl/AbC123xyz",
 *  cut to ~30 characters with an ellipsis. */
export function shortMapUrl(url?: string | null, max = 30) {
  const bare = (url || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare;
}

export function looksLikeMapsUrl(url?: string | null) {
  return /maps|goo\.gl|google\./i.test(url || "");
}

export function mapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Name, code, phone, address, map and notes: the six profile fields. */
export function depotProfileScore(
  depot: Pick<Depot, "name" | "code" | "phone" | "address" | "map_url" | "notes">
) {
  return [depot.name, depot.code, depot.phone, depot.address, depot.map_url, depot.notes].filter(
    (value) => Boolean(value && String(value).trim())
  ).length;
}

export function depotMissingInfo(depot: Pick<Depot, "phone" | "address" | "map_url">) {
  return !depot.phone || !depot.address || !depot.map_url;
}

/** "ACH" + the next number, from the first three letters/digits of the name. */
export function suggestDepotCode(name: string, depots: Pick<Depot, "code">[]) {
  const stem = name.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
  if (!stem) return "";
  const taken = new Set(depots.map((depot) => (depot.code || "").toUpperCase()));
  let next = depots.length + 1;
  while (taken.has(`${stem}${next}`)) next += 1;
  return `${stem}${next}`;
}

/** A plain-language message for a failed depot save. */
export function getDepotErrorMessage(error: unknown, code?: string | null) {
  const value = error as { code?: string; message?: string } | null;
  const text = `${value?.message || ""}`.toLowerCase();
  if (value?.code === "23505" && text.includes("depots_user_code_unique")) {
    return `Another depot already uses the code ${code || ""}. Choose a different code.`.replace("  ", " ");
  }
  if (value?.code === "23505" && text.includes("depots_user_name_unique")) {
    return "Another depot already has this name.";
  }
  return value?.message || "The depot could not be saved. Please try again.";
}

async function selectDepots(build: (columns: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>) {
  const first = await build(DEPOT_COLUMNS);
  if (!first.error) return first;
  // Phase 37 not run in this workspace: read the original columns.
  if (first.error.code === "42703" || /column/i.test(first.error.message || "")) {
    return build(DEPOT_COLUMNS_BASE);
  }
  return first;
}

export async function getDepotsForUser(userId: string, activeOnly = false) {
  const { data, error } = await selectDepots((columns) => {
    let query = supabase
      .from("depots")
      .select(columns)
      .eq("user_id", userId)
      .order("name", {
        ascending: true,
      });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    return query;
  });

  if (error) {
    throw error;
  }

  return ((data || []) as Partial<Depot>[]).map(normalizeDepot);
}

export async function getActiveDepotsForUser(userId: string) {
  return getDepotsForUser(userId, true);
}

export async function createDepot(userId: string, input: DepotInput) {
  const depot = normalizeDepotInput(input);

  if (!depot.name) {
    throw new Error("Depot name is required.");
  }

  const { data, error } = await supabase
    .from("depots")
    .insert([
      {
        user_id: userId,
        ...depot,
      },
    ])
    .select(DEPOT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return normalizeDepot(data as Partial<Depot>);
}

export async function updateDepot(
  userId: string,
  depotId: number,
  input: DepotInput
) {
  const depot = normalizeDepotInput(input);

  if (!depot.name) {
    throw new Error("Depot name is required.");
  }

  const { data, error } = await supabase
    .from("depots")
    .update(depot)
    .eq("id", depotId)
    .eq("user_id", userId)
    .select(DEPOT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return normalizeDepot(data as Partial<Depot>);
}

/** One field at a time, for the inline "Save" rows on the Depots page. */
export async function updateDepotFields(
  userId: string,
  depotId: number,
  patch: Partial<Pick<Depot, "phone" | "address" | "map_url" | "notes" | "is_active">>
) {
  const clean: Record<string, unknown> = { ...patch };
  if ("phone" in patch) clean.phone = normalizeDepotPhone(patch.phone);
  if ("address" in patch) clean.address = patch.address?.trim() || null;
  if ("map_url" in patch) clean.map_url = patch.map_url?.trim() || null;

  const { data, error } = await supabase
    .from("depots")
    .update(clean)
    .eq("id", depotId)
    .eq("user_id", userId)
    .select(DEPOT_COLUMNS)
    .single();

  if (error) throw error;
  return normalizeDepot(data as Partial<Depot>);
}

/** Makes this the business's only default depot (one transaction, server side). */
export async function setDefaultDepot(depotId: number) {
  const { error } = await supabase.rpc("set_default_depot", { p_depot_id: depotId });
  if (error) throw error;
}

export async function clearDefaultDepot(userId: string, depotId: number) {
  const { error } = await supabase
    .from("depots")
    .update({ is_default: false })
    .eq("id", depotId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Items in this depot that still hold stock -- the delete warning. */
export async function countStockedItemsInDepot(userId: string, depotId: number) {
  const { count, error } = await supabase
    .from("inventory")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("depot_id", depotId)
    .gt("quantity", 0);
  if (error) throw error;
  return count || 0;
}

export async function deleteDepot(userId: string, depotId: number) {
  const { error: unassignError } = await supabase
    .from("inventory")
    .update({
      depot_id: null,
    })
    .eq("user_id", userId)
    .eq("depot_id", depotId);

  if (unassignError) {
    throw unassignError;
  }

  const { error: deleteError } = await supabase
    .from("depots")
    .delete()
    .eq("id", depotId)
    .eq("user_id", userId);

  if (!deleteError) return;

  const { error: inactiveError } = await supabase
    .from("depots")
    .update({
      is_active: false,
    })
    .eq("id", depotId)
    .eq("user_id", userId);

  if (inactiveError) {
    throw inactiveError;
  }
}
