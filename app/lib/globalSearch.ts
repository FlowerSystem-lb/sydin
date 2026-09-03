import type { UiIconName } from "@/components/UiIcon";
import {
  formatDepotLabel,
  getDepotsForUser,
} from "@/app/lib/depots";
import {
  getEffectiveItemLowStockThreshold,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import {
  formatStockMovementNotes,
  getRecentStockMovements,
  STOCK_MOVEMENT_LABELS,
  type StockMovement,
} from "@/app/lib/stockMovements";
import { getSuppliersForUser, type Supplier } from "@/app/lib/suppliers";
import { supabase } from "@/app/lib/supabase";

export type SearchGroup =
  | "Items"
  | "Categories"
  | "Locations"
  | "Suppliers"
  | "Operations"
  | "Recent Activity"
  | "Pages";

export type SearchTone = "default" | "success" | "warning" | "danger" | "accent";

export interface SearchResult {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  chip: string;
  tone?: SearchTone;
  href: string;
  keywords: string;
}

interface SearchItem {
  id: number;
  name: string;
  category: string | null;
  category_id?: number | null;
  quantity: number;
  sku?: string | null;
  item_code?: string | null;
  barcode?: string | null;
  public_id?: string | null;
  min_stock_level?: number | null;
  unit_type?: InventoryUnitType | string | null;
  custom_unit_label?: string | null;
  supplier_id?: number | null;
  depot_id?: number | null;
}

interface SearchCategory {
  id: number;
  name: string;
  description: string | null;
}

interface PickListRow {
  id: number;
  title: string;
  customer_name: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface RecentRoute {
  label: string;
  href: string;
  savedAt: string;
}

/**
 * Recently opened ITEMS, kept separately from recent routes.
 *
 * `getSafeRecentRoutes` filters to STATIC_ROUTES, so an item page could never
 * appear there however often you opened it — which is why the empty search
 * offered pages you rarely need and never the product you were just looking at.
 * For an inventory app that is the wrong way round: the fastest path is usually
 * the thing you had open ten minutes ago.
 *
 * Stored per browser, like the other two lists. No server involved.
 */
export interface RecentItem {
  id: number;
  name: string;
  code: string;
  href: string;
  savedAt: string;
}

export const RECENT_ROUTES_STORAGE_KEY = "sydin:global-search-recent-routes";
export const RECENT_ITEMS_STORAGE_KEY = "sydin:global-search-recent-items";
export const RECENT_QUERIES_STORAGE_KEY = "sydin:global-search-recent-queries";
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_DEBOUNCE_MS = 180;
export const DEFAULT_MAX_RESULTS_PER_GROUP = 6;
const INVENTORY_ITEM_SEARCH_SELECT =
  "id, name, category, category_id, quantity, sku, item_code, barcode, public_id, min_stock_level, unit_type, custom_unit_label, supplier_id, depot_id";

export const SEARCH_GROUP_ORDER: SearchGroup[] = [
  "Items",
  "Categories",
  "Locations",
  "Suppliers",
  "Operations",
  "Recent Activity",
  "Pages",
];

export const GROUP_ICON: Record<SearchGroup, UiIconName> = {
  Items: "box",
  Categories: "categories",
  Locations: "depots",
  Suppliers: "suppliers",
  Operations: "movement",
  "Recent Activity": "clock",
  Pages: "file",
};

export const QUICK_ACTIONS: SearchResult[] = [
  {
    id: "action-add-item",
    group: "Operations",
    title: "Add item",
    subtitle: "Create a new inventory item",
    chip: "Action",
    tone: "accent",
    href: "/dashboard/add-item",
    keywords: "add item quick add create inventory",
  },
  {
    id: "action-receiving",
    group: "Operations",
    title: "Receive stock",
    subtitle: "Receive supplier delivery or manual restock",
    chip: "Page",
    href: "/dashboard/receiving",
    keywords: "receive receiving stock restock supplier delivery",
  },
  {
    id: "action-stock-count",
    group: "Operations",
    title: "Start stock count",
    subtitle: "Count stock and finalize movement adjustments",
    chip: "Page",
    href: "/dashboard/stock-counts",
    keywords: "stock count count inventory adjustment",
  },
  {
    id: "action-pick-list",
    group: "Operations",
    title: "Create pick list",
    subtitle: "Prepare stock for orders or fulfilment",
    chip: "Page",
    href: "/dashboard/pick-lists",
    keywords: "pick list picking fulfilment order",
  },
  {
    id: "action-purchase-order",
    group: "Operations",
    title: "Create purchase order",
    subtitle: "Build and export a purchase order draft",
    chip: "Page",
    href: "/dashboard/purchase-orders",
    keywords: "purchase order po supplier order",
  },
  {
    id: "action-scanner",
    group: "Operations",
    title: "Scanner",
    subtitle: "Open the scanner workspace for barcode and QR workflows",
    chip: "Page",
    href: "/dashboard/scanner",
    keywords: "scanner scan barcode qr code scan-first workflow",
  },
  {
    id: "action-alerts",
    group: "Pages",
    title: "Stock Alerts",
    subtitle: "Review low-stock and out-of-stock inventory alerts",
    chip: "Page",
    href: "/dashboard/alerts",
    keywords: "alerts stock alerts low stock out of stock inventory health",
  },
  {
    id: "action-activity",
    group: "Pages",
    title: "Activity",
    subtitle: "View unified timeline of inventory changes and events",
    chip: "Page",
    href: "/dashboard/activity",
    keywords: "activity timeline events feed history stock movements",
  },
  {
    id: "action-qr-center",
    group: "Pages",
    title: "QR Center",
    subtitle: "Print labels and use scanner workflows",
    chip: "Page",
    href: "/dashboard/qr-center",
    keywords: "qr labels scanner scan",
  },
  {
    id: "action-stock-movements",
    group: "Pages",
    title: "Stock Movements",
    subtitle: "Record and review stock movement history",
    chip: "Page",
    href: "/dashboard/stock-movements",
    keywords: "stock movement history stock in stock out",
  },
  {
    id: "action-reports",
    group: "Pages",
    title: "Reports",
    subtitle: "Review inventory value and movement reports",
    chip: "Page",
    href: "/dashboard/reports",
    keywords: "reports analytics pdf export value",
  },
];

export const STATIC_ROUTES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/inventory": "Inventory",
  "/dashboard/add-item": "Add item",
  "/dashboard/scanner": "Scanner",
  "/dashboard/pick-lists": "Pick Lists",
  "/dashboard/purchase-orders": "Purchase Orders",
  "/dashboard/receiving": "Stock In",
  "/dashboard/alerts": "Stock Alerts",
  "/dashboard/activity": "Activity",
  "/dashboard/stock-movements": "Stock Movements",
  "/dashboard/stock-counts": "Stock Counts",
  "/dashboard/qr-center": "QR Center",
  "/dashboard/depots": "Depots",
  "/dashboard/categories": "Categories",
  "/dashboard/suppliers": "Suppliers",
  "/dashboard/reports": "Reports",
  "/dashboard/settings": "Settings",
  "/dashboard/help": "Help Center",
};

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function sanitizeSearchTerm(value: string) {
  return value
    .trim()
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getItemChip(item: SearchItem) {
  const quantity = Number(item.quantity || 0);
  const lowStockThreshold = getEffectiveItemLowStockThreshold(
    item.min_stock_level,
    0
  );

  if (quantity <= 0) {
    return { chip: "Out of stock", tone: "danger" as const };
  }

  if (lowStockThreshold > 0 && quantity <= lowStockThreshold) {
    return { chip: "Low stock", tone: "warning" as const };
  }

  return { chip: "In stock", tone: "success" as const };
}

export function getSafeRecentRoutes(): RecentRoute[] {
  try {
    const rawRoutes = window.localStorage.getItem(RECENT_ROUTES_STORAGE_KEY);
    const parsed = rawRoutes ? (JSON.parse(rawRoutes) as RecentRoute[]) : [];

    return parsed.filter((route) => STATIC_ROUTES[route.href]).slice(0, 5);
  } catch {
    return [];
  }
}

export function rememberRecentRoute(result: SearchResult) {
  if (!STATIC_ROUTES[result.href]) return;

  try {
    const current = getSafeRecentRoutes().filter(
      (route) => route.href !== result.href
    );
    const next = [
      {
        label: result.title,
        href: result.href,
        savedAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 5);

    window.localStorage.setItem(RECENT_ROUTES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Recent route memory is optional.
  }
}

export function getSafeRecentItems(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(RECENT_ITEMS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentItem[]) : [];

    return parsed
      .filter((item) => item && typeof item.id === "number" && item.name)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function rememberRecentItem(item: {
  id: number;
  name: string;
  item_code?: string | null;
  sku?: string | null;
}) {
  try {
    const current = getSafeRecentItems().filter((entry) => entry.id !== item.id);
    const next: RecentItem[] = [
      {
        id: item.id,
        name: item.name,
        code: item.item_code || item.sku || "",
        href: `/dashboard/inventory/${item.id}`,
        savedAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 5);

    window.localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Recent item memory is optional, exactly like the other two lists.
  }
}

export function getSafeRecentQueries(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_QUERIES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return parsed.filter((entry) => typeof entry === "string").slice(0, 6);
  } catch {
    return [];
  }
}

export function rememberRecentQuery(term: string) {
  const trimmed = term.trim();
  if (trimmed.length < SEARCH_MIN_LENGTH || trimmed.length > 100) return;

  try {
    const current = getSafeRecentQueries().filter(
      (entry) => entry.toLowerCase() !== trimmed.toLowerCase()
    );
    const next = [trimmed, ...current].slice(0, 6);
    window.localStorage.setItem(RECENT_QUERIES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Recent query memory is optional.
  }
}

export function clearRecentQueries() {
  try {
    window.localStorage.removeItem(RECENT_QUERIES_STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

export function groupResults(
  results: SearchResult[],
  maxResultsPerGroup = DEFAULT_MAX_RESULTS_PER_GROUP
) {
  const groups = new Map<SearchGroup, SearchResult[]>();

  for (const result of results) {
    const current = groups.get(result.group) || [];
    if (current.length < maxResultsPerGroup) {
      current.push(result);
      groups.set(result.group, current);
    }
  }

  return SEARCH_GROUP_ORDER.flatMap((group) => {
    const groupItems = groups.get(group);
    return groupItems ? ([[group, groupItems]] as Array<[SearchGroup, SearchResult[]]>) : [];
  });
}

function normalizeItemMatchScore(item: SearchItem, query: string) {
  const normalizedName = normalizeText(item.name);
  const normalizedSku = normalizeText(item.sku || "");
  const normalizedCode = normalizeText(item.item_code || "");
  const normalizedBarcode = normalizeText(item.barcode || "");
  const normalizedPublicId = normalizeText(item.public_id || "");

  if (normalizedName === query) return 0;
  if (normalizedName.startsWith(query)) return 1;
  if (
    normalizedSku === query ||
    normalizedCode === query ||
    normalizedBarcode === query ||
    normalizedPublicId === query
  ) {
    return 2;
  }
  if (
    normalizedSku.startsWith(query) ||
    normalizedCode.startsWith(query) ||
    normalizedBarcode.startsWith(query) ||
    normalizedPublicId.startsWith(query)
  ) {
    return 3;
  }
  if (normalizedName.includes(query)) return 4;

  return 5;
}

function dedupeAndSortItems(items: SearchItem[], query: string) {
  const itemById = new Map<number, SearchItem>();

  for (const item of items) {
    itemById.set(item.id, item);
  }

  return Array.from(itemById.values()).sort((first, second) => {
    const scoreDelta =
      normalizeItemMatchScore(first, query) - normalizeItemMatchScore(second, query);
    if (scoreDelta !== 0) return scoreDelta;

    return first.name.localeCompare(second.name);
  });
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function matchesQuickAction(action: SearchResult, query: string) {
  const normalizedQuery = normalizeText(query);

  return [action.title, action.subtitle, action.keywords]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

/** Splits `text` into segments so callers can highlight the part matching `query`. */
export function splitForHighlight(text: string, query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [{ text, match: false }];

  const index = text.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (index === -1) return [{ text, match: false }];

  return [
    { text: text.slice(0, index), match: false },
    { text: text.slice(index, index + trimmedQuery.length), match: true },
    { text: text.slice(index + trimmedQuery.length), match: false },
  ].filter((segment) => segment.text.length > 0);
}

export interface RunGlobalSearchOptions {
  /** Caps how many rows land in each group after scoring. Preview surfaces want few; the full results page wants many. */
  maxResultsPerGroup?: number;
  /** "full" widens the underlying Supabase query limits for the dedicated search page. */
  depth?: "preview" | "full";
}

export interface RunGlobalSearchResult {
  results: SearchResult[];
  failed: boolean;
}

export async function runGlobalSearch(
  userId: string,
  pathname: string,
  rawTerm: string,
  options: RunGlobalSearchOptions = {}
): Promise<RunGlobalSearchResult> {
  const maxResultsPerGroup = options.maxResultsPerGroup ?? DEFAULT_MAX_RESULTS_PER_GROUP;
  const isFullDepth = options.depth === "full";
  const itemQueryLimit = isFullDepth ? 60 : 10;
  const categoryQueryLimit = isFullDepth ? 40 : 8;
  const pickListQueryLimit = isFullDepth ? 40 : 8;
  const movementQueryLimit = isFullDepth ? 200 : 80;
  const relationItemQueryLimit = isFullDepth ? 60 : 12;

  const sanitizedTerm = sanitizeSearchTerm(rawTerm);
  const likeTerm = `%${sanitizedTerm}%`;
  const normalizedQuery = normalizeText(sanitizedTerm);

  const [
    suppliersResult,
    depotsResult,
    itemsResult,
    categoriesResult,
    movementsResult,
    pickListsResult,
  ] = await Promise.allSettled([
    getSuppliersForUser(userId),
    getDepotsForUser(userId),
    supabase
      .from("inventory")
      .select(INVENTORY_ITEM_SEARCH_SELECT)
      .eq("user_id", userId)
      .or(
        `name.ilike.${likeTerm},sku.ilike.${likeTerm},item_code.ilike.${likeTerm},barcode.ilike.${likeTerm},category.ilike.${likeTerm}`
      )
      .order("name", { ascending: true })
      .limit(itemQueryLimit),
    supabase
      .from("categories")
      .select("id, name, description")
      .eq("user_id", userId)
      .or(`name.ilike.${likeTerm},description.ilike.${likeTerm}`)
      .order("name", { ascending: true })
      .limit(categoryQueryLimit),
    getRecentStockMovements(userId, movementQueryLimit),
    supabase
      .from("pick_lists")
      .select("id, title, customer_name, status, notes, created_at")
      .eq("user_id", userId)
      .or(
        `title.ilike.${likeTerm},customer_name.ilike.${likeTerm},status.ilike.${likeTerm},notes.ilike.${likeTerm}`
      )
      .order("created_at", { ascending: false })
      .limit(pickListQueryLimit),
  ]);

  const suppliers =
    suppliersResult.status === "fulfilled" ? suppliersResult.value : [];
  const depots = depotsResult.status === "fulfilled" ? depotsResult.value : [];
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const depotById = new Map(depots.map((depot) => [depot.id, depot]));
  const categoryRows =
    categoriesResult.status === "fulfilled" && !categoriesResult.value.error
      ? ((categoriesResult.value.data || []) as SearchCategory[])
      : [];
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const matchingSupplierIds = suppliers
    .filter((supplier: Supplier) =>
      [
        supplier.name,
        supplier.contact_name,
        supplier.phone,
        supplier.whatsapp,
        supplier.email,
        supplier.address,
        supplier.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    )
    .map((supplier) => supplier.id);
  const matchingDepotIds = depots
    .filter((depot) =>
      [depot.name, depot.code, depot.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    )
    .map((depot) => depot.id);
  const matchingCategoryIds = categoryRows.map((category) => category.id);
  const movementItemsById = new Map<number, SearchItem>();
  const nextResults: SearchResult[] = [];

  if (movementsResult.status === "fulfilled") {
    const movementItemIds = Array.from(
      new Set(
        movementsResult.value
          .map((movement) => movement.item_id)
          .filter(
            (itemId): itemId is number => typeof itemId === "number" && itemId > 0
          )
      )
    );

    if (movementItemIds.length > 0) {
      const { data: movementItems } = await supabase
        .from("inventory")
        .select(INVENTORY_ITEM_SEARCH_SELECT)
        .eq("user_id", userId)
        .in("id", movementItemIds);

      for (const item of movementItems || []) {
        movementItemsById.set(Number(item.id), item as SearchItem);
      }
    }
  }

  const directItemRows =
    itemsResult.status === "fulfilled" && !itemsResult.value.error
      ? ((itemsResult.value.data || []) as SearchItem[])
      : [];
  const relationItemClauses = [
    matchingCategoryIds.length
      ? `category_id.in.(${matchingCategoryIds.join(",")})`
      : "",
    matchingDepotIds.length ? `depot_id.in.(${matchingDepotIds.join(",")})` : "",
    matchingSupplierIds.length
      ? `supplier_id.in.(${matchingSupplierIds.join(",")})`
      : "",
  ].filter(Boolean);
  let relationItemRows: SearchItem[] = [];
  let publicIdItemRows: SearchItem[] = [];

  if (relationItemClauses.length > 0) {
    const { data: relatedItems, error: relatedItemsError } = await supabase
      .from("inventory")
      .select(INVENTORY_ITEM_SEARCH_SELECT)
      .eq("user_id", userId)
      .or(relationItemClauses.join(","))
      .order("name", { ascending: true })
      .limit(relationItemQueryLimit);

    if (!relatedItemsError) {
      relationItemRows = (relatedItems || []) as SearchItem[];
    }
  }

  if (looksLikeUuid(sanitizedTerm)) {
    const { data: publicIdItems, error: publicIdError } = await supabase
      .from("inventory")
      .select(INVENTORY_ITEM_SEARCH_SELECT)
      .eq("user_id", userId)
      .eq("public_id", sanitizedTerm)
      .limit(1);

    if (!publicIdError) {
      publicIdItemRows = (publicIdItems || []) as SearchItem[];
    }
  }

  const movementFallbackItemRows =
    movementsResult.status === "fulfilled"
      ? movementsResult.value
          .filter((movement: StockMovement) => {
            const item = movement.item_id
              ? movementItemsById.get(movement.item_id)
              : null;

            return [
              item?.name,
              item?.sku,
              item?.item_code,
              item?.barcode,
              item?.category,
              item?.public_id,
              movement.movement_type,
              STOCK_MOVEMENT_LABELS[movement.movement_type],
              movement.notes,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery);
          })
          .map((movement) =>
            movement.item_id ? movementItemsById.get(movement.item_id) : null
          )
          .filter((item): item is SearchItem => Boolean(item))
      : [];

  const itemRows = dedupeAndSortItems(
    [...directItemRows, ...publicIdItemRows, ...relationItemRows, ...movementFallbackItemRows],
    normalizedQuery
  ).slice(0, maxResultsPerGroup);

  for (const item of itemRows) {
    const supplier = item.supplier_id ? supplierById.get(item.supplier_id) : null;
    const depot = item.depot_id ? depotById.get(item.depot_id) : null;
    const category = item.category_id ? categoryById.get(item.category_id) : null;
    const status = getItemChip(item);
    const details = [
      [item.item_code, item.sku, item.barcode].filter(Boolean).join(" / "),
      category?.name || item.category || "Uncategorized",
      formatDepotLabel(depot),
      supplier?.name,
    ].filter(Boolean);

    nextResults.push({
      id: `item-${item.id}`,
      group: "Items",
      title: item.name,
      subtitle: details.join(" | "),
      chip: status.chip,
      tone: status.tone,
      href: `/dashboard/inventory/${item.id}?returnTo=${encodeURIComponent(
        pathname.startsWith("/dashboard") ? pathname : "/dashboard/inventory"
      )}`,
      keywords: details.join(" "),
    });
  }

  for (const category of categoryRows) {
    nextResults.push({
      id: `category-${category.id}`,
      group: "Categories",
      title: category.name,
      subtitle: category.description || "Inventory category",
      chip: "Category",
      href: `/dashboard/categories?category=${category.id}`,
      keywords: category.description || "",
    });
  }

  for (const depot of depots
    .filter((depot) => matchingDepotIds.includes(depot.id))
    .slice(0, maxResultsPerGroup)) {
    nextResults.push({
      id: `depot-${depot.id}`,
      group: "Locations",
      title: formatDepotLabel(depot),
      subtitle: depot.notes || "Inventory location",
      chip: depot.is_active ? "Active" : "Inactive",
      href: `/dashboard/inventory?depot=${depot.id}`,
      keywords: [depot.name, depot.code, depot.notes].filter(Boolean).join(" "),
    });
  }

  for (const supplier of suppliers
    .filter((supplier: Supplier) => matchingSupplierIds.includes(supplier.id))
    .slice(0, maxResultsPerGroup)) {
    nextResults.push({
      id: `supplier-${supplier.id}`,
      group: "Suppliers",
      title: supplier.name,
      subtitle:
        [supplier.contact_name, supplier.email, supplier.phone]
          .filter(Boolean)
          .join(" | ") || "Supplier",
      chip: "Supplier",
      href: "/dashboard/suppliers",
      keywords: [supplier.name, supplier.contact_name, supplier.email]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (movementsResult.status === "fulfilled") {
    for (const movement of movementsResult.value
      .filter((movement: StockMovement) => {
        const item = movement.item_id ? movementItemsById.get(movement.item_id) : null;

        return [
          item?.name,
          item?.sku,
          item?.item_code,
          movement.movement_type,
          STOCK_MOVEMENT_LABELS[movement.movement_type],
          movement.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .slice(0, maxResultsPerGroup)) {
      const item = movement.item_id ? movementItemsById.get(movement.item_id) : null;
      nextResults.push({
        id: `movement-${movement.id}`,
        group: "Recent Activity",
        title: item?.name || "Stock movement",
        subtitle: [
          STOCK_MOVEMENT_LABELS[movement.movement_type],
          formatDate(movement.created_at),
          formatStockMovementNotes(movement.notes),
        ]
          .filter(Boolean)
          .join(" | "),
        chip: STOCK_MOVEMENT_LABELS[movement.movement_type],
        tone: movement.quantity_delta > 0 ? "success" : "default",
        href: "/dashboard/stock-movements",
        keywords: movement.notes || "",
      });
    }
  }

  if (pickListsResult.status === "fulfilled" && !pickListsResult.value.error) {
    const pickListRows = (pickListsResult.value.data || []) as PickListRow[];
    for (const pickList of pickListRows) {
      nextResults.push({
        id: `pick-list-${pickList.id}`,
        group: "Operations",
        title: pickList.title,
        subtitle:
          [pickList.customer_name, formatDate(pickList.created_at)]
            .filter(Boolean)
            .join(" | ") || "Pick List",
        chip: pickList.status || "Pick List",
        href: `/dashboard/pick-lists/${pickList.id}`,
        keywords: [pickList.title, pickList.customer_name, pickList.notes]
          .filter(Boolean)
          .join(" "),
      });
    }
  }

  const failedSearches = [
    suppliersResult,
    depotsResult,
    itemsResult,
    categoriesResult,
    movementsResult,
    pickListsResult,
  ].filter((result) => result.status === "rejected").length;

  return {
    results: nextResults,
    failed: failedSearches === 6,
  };
}
