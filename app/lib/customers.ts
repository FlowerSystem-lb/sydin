import { supabase } from "@/app/lib/supabase";

/**
 * Who the depot sells TO.
 *
 * A deliberate mirror of `app/lib/suppliers.ts`, because suppliers is the same
 * shape of problem solved and shipped months ago: a named party with contact
 * details, owned by one account, unique by name. Same functions, same error
 * handling, same WhatsApp helper. Anything that has to be learned twice will
 * eventually be got wrong once.
 *
 * The one structural difference is what a customer is counted BY. A supplier
 * is counted by how many products it supplies, because products carry a
 * `supplier_id`. Nothing carries a `customer_id` yet -- sales are phase 20 --
 * so `order_count` is left off rather than faked. It arrives when sales do.
 */
export interface Customer {
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
}

export interface CustomerInput {
  name: string;
  contact_name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  notes?: string;
}

function normalizeCustomerInput(input: CustomerInput) {
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

export async function getCustomersForUser(userId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data as Customer[]) || [];
}

export async function createCustomer(
  userId: string,
  input: CustomerInput
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      user_id: userId,
      ...normalizeCustomerInput(input),
    })
    .select("*")
    .single();

  if (error) throw error;

  return data as Customer;
}

export async function updateCustomer(
  userId: string,
  customerId: number,
  input: CustomerInput
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .update(normalizeCustomerInput(input))
    .eq("id", customerId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;

  return data as Customer;
}

export async function deleteCustomer(userId: string, customerId: number) {
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("user_id", userId);

  if (error) throw error;
}

export function getCustomerErrorMessage(error: unknown) {
  const customerError = error as {
    code?: string;
    message?: string;
    details?: string;
  };
  const text =
    `${customerError?.message || ""} ${customerError?.details || ""}`.toLowerCase();

  if (customerError?.code === "23505" || text.includes("unique")) {
    return "A customer with this name already exists.";
  }

  if (
    customerError?.code === "PGRST204" ||
    customerError?.code === "42P01" ||
    text.includes("customers")
  ) {
    return "Customers are not available in this workspace yet. Contact support if this keeps happening.";
  }

  return "We could not save this customer. Please try again.";
}
