import { supabase } from "@/app/lib/supabase";

export interface Depot {
  id: number;
  name: string;
  code: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface DepotInput {
  name: string;
  code?: string;
  notes?: string;
  is_active?: boolean;
}

function normalizeDepot(data: Partial<Depot>): Depot {
  return {
    id: Number(data.id),
    name: data.name?.trim() || "Unnamed depot",
    code: data.code || null,
    notes: data.notes || null,
    is_active: data.is_active !== false,
  };
}

function normalizeDepotInput(input: DepotInput) {
  return {
    name: input.name.trim(),
    code: input.code?.trim() || null,
    notes: input.notes?.trim() || null,
    is_active: input.is_active !== false,
  };
}

export function formatDepotLabel(depot?: Pick<Depot, "name" | "code"> | null) {
  if (!depot) return "Unassigned";

  return depot.code ? `${depot.name} (${depot.code})` : depot.name;
}

export async function getDepotsForUser(userId: string, activeOnly = false) {
  let query = supabase
    .from("depots")
    .select("id, name, code, notes, is_active")
    .eq("user_id", userId)
    .order("name", {
      ascending: true,
    });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

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
    .select("id, name, code, notes, is_active")
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
    .select("id, name, code, notes, is_active")
    .single();

  if (error) {
    throw error;
  }

  return normalizeDepot(data as Partial<Depot>);
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
