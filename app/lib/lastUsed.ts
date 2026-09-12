/**
 * Small conveniences the brief asked for (point 44): the depot you picked
 * last time and the way you usually pay come back pre-filled. Per browser,
 * in localStorage; never anything that needs to be right, only a default the
 * next form starts from. Every reader guards against storage being absent.
 */
const KEYS = {
  depot: "sydin:last-depot",
  paymentMethod: "sydin:last-payment-method",
} as const;

function read(key: string) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* Not remembering it is no reason to refuse the save. */
  }
}

export function getLastDepotId() {
  return typeof window === "undefined" ? "" : read(KEYS.depot);
}

export function rememberDepotId(depotId: string | null | undefined) {
  if (typeof window !== "undefined") write(KEYS.depot, depotId || "");
}

export function getLastPaymentMethod() {
  return typeof window === "undefined" ? "" : read(KEYS.paymentMethod);
}

export function rememberPaymentMethod(method: string | null | undefined) {
  if (typeof window !== "undefined") write(KEYS.paymentMethod, method || "");
}
