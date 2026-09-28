/* Personal preferences (Settings > Preferences, 28 Sep 2026).
 *
 * From Sortly's Preferences page, keeping only what SydIN can honour:
 *  - time zone: SydIN already shows every date in the device's own time zone,
 *    which is what Sortly's "Set automatically" does -- nothing to set;
 *  - email alerts / threads: SydIN sends no email and has no threads yet, so
 *    a switch would do nothing. Add it here when email alerts exist.
 * What is left is how Inventory opens. Stored per browser: it is a personal
 * habit, not a business setting, and differs between a phone and a desk. */

export type InventorySort =
  | "newest"
  | "oldest"
  | "name-az"
  | "name-za"
  | "quantity-asc"
  | "quantity-desc";

export const INVENTORY_SORT_OPTIONS: { value: InventorySort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-az", label: "Name A–Z" },
  { value: "name-za", label: "Name Z–A" },
  { value: "quantity-asc", label: "Quantity: low to high" },
  { value: "quantity-desc", label: "Quantity: high to low" },
];

const SORT_KEY = "sydin:pref-inventory-sort";

export function isInventorySort(value: string | null | undefined): value is InventorySort {
  return INVENTORY_SORT_OPTIONS.some((option) => option.value === value);
}

export function getDefaultInventorySort(): InventorySort {
  try {
    const stored = window.localStorage.getItem(SORT_KEY);
    return isInventorySort(stored) ? stored : "newest";
  } catch {
    return "newest";
  }
}

export function setDefaultInventorySort(sort: InventorySort) {
  try {
    window.localStorage.setItem(SORT_KEY, sort);
  } catch {
    // Storage blocked (private mode): the choice lasts for this visit only.
  }
}
