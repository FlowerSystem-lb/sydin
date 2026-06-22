import { supabase } from "@/app/lib/supabase";

export interface Supplier {
  id: number;
  user_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  item_count?: number;
}

export interface SupplierInput {
  name: string;
  contact_name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  notes?: string;
}

function normalizeSupplierInput(input: SupplierInput) {
  return {
    name: input.name.trim(),
    contact_name: input.contact_name?.trim() || null,
    phone: input.phone?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

export async function getSuppliersForUser(userId: string): Promise<Supplier[]> {
  const [{ data: suppliers, error }, { data: inventory, error: itemError }] =
    await Promise.all([
      supabase
        .from("suppliers")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true }),
      supabase
        .from("inventory")
        .select("supplier_id")
        .eq("user_id", userId)
        .not("supplier_id", "is", null),
    ]);

  if (error) throw error;

  const itemCounts = new Map<number, number>();

  if (!itemError) {
    for (const item of inventory || []) {
      const supplierId = Number(item.supplier_id);
      itemCounts.set(supplierId, (itemCounts.get(supplierId) || 0) + 1);
    }
  }

  return ((suppliers as Supplier[]) || []).map((supplier) => ({
    ...supplier,
    item_count: itemCounts.get(supplier.id) || 0,
  }));
}

export async function createSupplier(
  userId: string,
  input: SupplierInput
): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      user_id: userId,
      ...normalizeSupplierInput(input),
    })
    .select("*")
    .single();

  if (error) throw error;

  return data as Supplier;
}

export async function updateSupplier(
  userId: string,
  supplierId: number,
  input: SupplierInput
): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .update(normalizeSupplierInput(input))
    .eq("id", supplierId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;

  return data as Supplier;
}

export async function deleteSupplier(userId: string, supplierId: number) {
  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", supplierId)
    .eq("user_id", userId);

  if (error) throw error;
}

export function getSupplierErrorMessage(error: unknown) {
  const supplierError = error as {
    code?: string;
    message?: string;
    details?: string;
  };
  const text =
    `${supplierError?.message || ""} ${supplierError?.details || ""}`.toLowerCase();

  if (supplierError?.code === "23505" || text.includes("unique")) {
    return "A supplier with this name already exists.";
  }

  if (
    supplierError?.code === "PGRST204" ||
    supplierError?.code === "42P01" ||
    text.includes("suppliers")
  ) {
    return "Suppliers are not available in this workspace yet. Contact support if this keeps happening.";
  }

  return "We could not save this supplier. Please try again.";
}

export function getWhatsAppHref(value: string) {
  const digits = value.replace(/\D/g, "");

  return digits ? `https://wa.me/${digits}` : "";
}
