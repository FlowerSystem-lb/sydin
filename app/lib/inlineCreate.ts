import { createCategory, type Category } from "@/app/lib/categories";
import { createCustomer, type Customer } from "@/app/lib/customers";
import { createDepot, type Depot } from "@/app/lib/depots";
import { createSupplier, type Supplier } from "@/app/lib/suppliers";
import { supabase } from "@/app/lib/supabase";

/**
 * "If it is not in the list, add it here and carry on."
 *
 * Every one of these records could only be created on its own page, which
 * meant that finding a missing category halfway through adding an item cost
 * you the item: leave, create, come back, start again. These wrap the
 * existing create* functions with the two things a dropdown needs -- resolve
 * the signed-in user itself, and hand back the new row -- so a Select's
 * `onCreate` is a one-liner at each call site.
 *
 * Only the name is set. Everything else on these records (a supplier's
 * phone, a depot's code) stays optional and gets filled in on that record's
 * own page when there is a reason to; creating from a dropdown is for
 * getting unblocked, not for capturing a full profile.
 */

async function requireUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Please sign in again.");

  return user.id;
}

export async function createCategoryInline(name: string): Promise<Category> {
  return createCategory(await requireUserId(), { name });
}

export async function createDepotInline(name: string): Promise<Depot> {
  return createDepot(await requireUserId(), { name });
}

export async function createSupplierInline(name: string): Promise<Supplier> {
  return createSupplier(await requireUserId(), { name });
}

export async function createCustomerInline(name: string): Promise<Customer> {
  return createCustomer(await requireUserId(), { name });
}
