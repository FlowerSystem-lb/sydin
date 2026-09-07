export const ADD_ITEM_REQUEST_EVENT = "sydin:request-add-item";
export const ADD_ITEM_REQUEST_STORAGE_KEY = "sydin:pending-add-item";

export interface AddItemRequest {
  /** Preselects a category -- used by the Categories page's own "Add item". */
  categoryId?: string;
}

/**
 * "Add Item" means the same thing everywhere: the slide-over panel, not a
 * page you have to come back from.
 *
 * Inventory hosts that panel, so a request raised while standing on
 * Inventory is just an event. Raised anywhere else -- the header's + Add
 * menu, the phone's quick add, Overview, Categories -- it is left in session
 * storage and Inventory picks it up on arrival. Landing on Inventory is the
 * right destination anyway: you have just created an inventory item, and it
 * is the first thing you see.
 *
 * This is the same shape as the scanner request (app/lib/scannerNavigation.ts),
 * deliberately -- one convention in this codebase for "a button over here
 * needs a panel that lives over there".
 */
export function requestAddItem(
  request: AddItemRequest,
  {
    pathname,
    navigate,
  }: { pathname: string; navigate: (href: string) => void }
) {
  if (pathname === "/dashboard/inventory") {
    window.dispatchEvent(
      new CustomEvent(ADD_ITEM_REQUEST_EVENT, { detail: request })
    );
    return;
  }

  try {
    window.sessionStorage.setItem(
      ADD_ITEM_REQUEST_STORAGE_KEY,
      JSON.stringify(request)
    );
  } catch {
    // Private browsing can refuse storage. The navigation still happens; the
    // panel simply won't open by itself, which is a worse outcome than
    // intended but not a broken one.
  }

  navigate("/dashboard/inventory");
}

/** Reads and clears a pending request. Returns null when there isn't one. */
export function takePendingAddItemRequest(): AddItemRequest | null {
  try {
    const raw = window.sessionStorage.getItem(ADD_ITEM_REQUEST_STORAGE_KEY);
    if (!raw) return null;

    window.sessionStorage.removeItem(ADD_ITEM_REQUEST_STORAGE_KEY);
    return JSON.parse(raw) as AddItemRequest;
  } catch {
    return null;
  }
}
