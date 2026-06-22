"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
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
import { cx } from "@/components/ui/utils";

type SearchGroup =
  | "Items"
  | "Categories"
  | "Locations"
  | "Suppliers"
  | "Operations"
  | "Recent Activity"
  | "Pages";

type SearchTone = "default" | "success" | "warning" | "danger" | "accent";

interface SearchResult {
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

interface RecentRoute {
  label: string;
  href: string;
  savedAt: string;
}

interface GlobalSearchDialogProps {
  open: boolean;
  userId: string;
  pathname: string;
  onClose: () => void;
}

const RECENT_ROUTES_STORAGE_KEY = "sydin:global-search-recent-routes";
const SEARCH_MIN_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 180;
const MAX_RESULTS_PER_GROUP = 6;
const INVENTORY_ITEM_SEARCH_SELECT =
  "id, name, category, category_id, quantity, sku, item_code, barcode, public_id, min_stock_level, unit_type, custom_unit_label, supplier_id, depot_id";
const SEARCH_GROUP_ORDER: SearchGroup[] = [
  "Items",
  "Categories",
  "Locations",
  "Suppliers",
  "Operations",
  "Recent Activity",
  "Pages",
];

const QUICK_ACTIONS: SearchResult[] = [
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
    subtitle: "Build a browser-local purchase order draft",
    chip: "Page",
    href: "/dashboard/purchase-orders",
    keywords: "purchase order po supplier order",
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

const STATIC_ROUTES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/inventory": "Inventory",
  "/dashboard/add-item": "Add item",
  "/dashboard/pick-lists": "Pick Lists",
  "/dashboard/purchase-orders": "Purchase Orders",
  "/dashboard/receiving": "Receiving",
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

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function sanitizeSearchTerm(value: string) {
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

function getSafeRecentRoutes() {
  try {
    const rawRoutes = window.localStorage.getItem(RECENT_ROUTES_STORAGE_KEY);
    const parsed = rawRoutes ? (JSON.parse(rawRoutes) as RecentRoute[]) : [];

    return parsed
      .filter((route) => STATIC_ROUTES[route.href])
      .slice(0, 5);
  } catch {
    return [];
  }
}

function rememberRecentRoute(result: SearchResult) {
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

function groupResults(results: SearchResult[]) {
  const groups = new Map<SearchGroup, SearchResult[]>();

  for (const result of results) {
    const current = groups.get(result.group) || [];
    if (current.length < MAX_RESULTS_PER_GROUP) {
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

function matchesQuickAction(action: SearchResult, query: string) {
  const normalizedQuery = normalizeText(query);

  return [action.title, action.subtitle, action.keywords]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export default function GlobalSearchDialog({
  open,
  userId,
  pathname,
  onClose,
}: GlobalSearchDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);

  const staticQuickResults = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) =>
        query.trim().length >= SEARCH_MIN_LENGTH
          ? matchesQuickAction(action, query)
          : true
      ),
    [query]
  );

  const emptyStateResults = useMemo(() => {
    const recentResults: SearchResult[] = recentRoutes.map((route) => ({
      id: `recent-${route.href}`,
      group: "Pages",
      title: route.label,
      subtitle: "Recently opened page",
      chip: "Recent",
      href: route.href,
      keywords: route.label,
    }));

    return [...recentResults, ...QUICK_ACTIONS];
  }, [recentRoutes]);

  const visibleResults =
    query.trim().length >= SEARCH_MIN_LENGTH
      ? [...results, ...staticQuickResults]
      : emptyStateResults;
  const groupedResults = groupResults(visibleResults);
  const flatResults = groupedResults.flatMap(([, groupItems]) => groupItems);
  const activeResult = flatResults[activeIndex] || null;

  const closeDialog = useCallback(() => {
    setQuery("");
    setResults([]);
    setError("");
    setActiveIndex(0);
    onClose();
  }, [onClose]);

  const openResult = useCallback(
    (result: SearchResult) => {
      rememberRecentRoute(result);
      closeDialog();
      router.push(result.href);
    },
    [closeDialog, router]
  );

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      setRecentRoutes(getSafeRecentRoutes());
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const label = STATIC_ROUTES[pathname];
    if (!label) return;

    rememberRecentRoute({
      id: `current-${pathname}`,
      group: "Pages",
      title: label,
      subtitle: "Recently opened page",
      chip: "Recent",
      href: pathname,
      keywords: label,
    });
  }, [open, pathname]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDialog, open]);

  useEffect(() => {
    if (!open) return;

    const sanitizedTerm = sanitizeSearchTerm(query);

    if (sanitizedTerm.length < SEARCH_MIN_LENGTH) {
      searchRequestRef.current += 1;
      const frame = window.requestAnimationFrame(() => {
        setResults([]);
        setLoading(false);
        setError("");
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const timeout = window.setTimeout(() => {
      const likeTerm = `%${sanitizedTerm}%`;
      setLoading(true);
      setError("");

      async function runSearch() {
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
            .limit(10),
          supabase
            .from("categories")
            .select("id, name, description")
            .eq("user_id", userId)
            .or(`name.ilike.${likeTerm},description.ilike.${likeTerm}`)
            .order("name", { ascending: true })
            .limit(8),
          getRecentStockMovements(userId, 80),
          supabase
            .from("pick_lists")
            .select("id, title, customer_name, status, notes, created_at")
            .eq("user_id", userId)
            .or(
              `title.ilike.${likeTerm},customer_name.ilike.${likeTerm},status.ilike.${likeTerm},notes.ilike.${likeTerm}`
            )
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

        if (searchRequestRef.current !== requestId) return;

        const suppliers =
          suppliersResult.status === "fulfilled" ? suppliersResult.value : [];
        const depots =
          depotsResult.status === "fulfilled" ? depotsResult.value : [];
        const supplierById = new Map(
          suppliers.map((supplier) => [supplier.id, supplier])
        );
        const depotById = new Map(depots.map((depot) => [depot.id, depot]));
        const normalizedQuery = normalizeText(sanitizedTerm);
        const categoryRows =
          categoriesResult.status === "fulfilled" && !categoriesResult.value.error
            ? ((categoriesResult.value.data || []) as SearchCategory[])
            : [];
        const categoryById = new Map(
          categoryRows.map((category) => [category.id, category])
        );
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
        const movementItemsById = new Map<
          number,
          SearchItem
        >();
        const nextResults: SearchResult[] = [];

        if (movementsResult.status === "fulfilled") {
          const movementItemIds = Array.from(
            new Set(
              movementsResult.value
                .map((movement) => movement.item_id)
                .filter(
                  (itemId): itemId is number =>
                    typeof itemId === "number" && itemId > 0
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
            .limit(12);

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
          [
            ...directItemRows,
            ...publicIdItemRows,
            ...relationItemRows,
            ...movementFallbackItemRows,
          ],
          normalizedQuery
        ).slice(0, MAX_RESULTS_PER_GROUP);

        for (const item of itemRows) {
          const supplier = item.supplier_id
            ? supplierById.get(item.supplier_id)
            : null;
          const depot = item.depot_id ? depotById.get(item.depot_id) : null;
          const category = item.category_id
            ? categoryById.get(item.category_id)
            : null;
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

        if (categoryRows.length > 0) {
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
        }

        for (const depot of depots
          .filter((depot) => matchingDepotIds.includes(depot.id))
          .slice(0, MAX_RESULTS_PER_GROUP)) {
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
          .slice(0, MAX_RESULTS_PER_GROUP)) {
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
              const item = movement.item_id
                ? movementItemsById.get(movement.item_id)
                : null;

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
            .slice(0, MAX_RESULTS_PER_GROUP)) {
            const item = movement.item_id
              ? movementItemsById.get(movement.item_id)
              : null;
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

        if (
          pickListsResult.status === "fulfilled" &&
          !pickListsResult.value.error
        ) {
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

        setResults(nextResults);
        setError(
          failedSearches === 6
            ? "Search is unavailable right now. Try again in a moment."
            : ""
        );
        setLoading(false);
      }

      runSearch().catch(() => {
        if (searchRequestRef.current !== requestId) return;
        setResults([]);
        setError("Search is unavailable right now. Try again in a moment.");
        setLoading(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [open, pathname, query, userId]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        flatResults.length === 0 ? 0 : (current + 1) % flatResults.length
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        flatResults.length === 0
          ? 0
          : (current - 1 + flatResults.length) % flatResults.length
      );
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      openResult(activeResult);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center bg-[var(--bg-overlay)] p-3 pt-16 backdrop-blur-md sm:items-center sm:p-6 sm:pt-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[46rem] flex-col overflow-hidden rounded-[18px] border border-theme bg-[var(--bg-surface-strong)] text-theme-primary shadow-[0_28px_90px_rgba(0,0,0,0.35)] sm:max-h-[42rem]"
      >
        <div className="border-b border-theme p-3">
          <div className="flex items-center gap-3">
            <UiIcon name="search" className="h-5 w-5 shrink-0 text-theme-subtle" />
            <div className="min-w-0 flex-1">
              <h2 id="global-search-title" className="sr-only">
                Global search
              </h2>
              <label htmlFor="global-search-input" className="sr-only">
                Search items, categories, suppliers, movements
              </label>
              <input
                ref={inputRef}
                id="global-search-input"
                type="search"
                value={query}
                onChange={(event) => {
                  setActiveIndex(0);
                  setQuery(event.target.value);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search items, categories, suppliers, movements..."
                className="min-h-11 w-full bg-transparent text-base font-semibold text-theme-primary outline-none placeholder:text-theme-subtle"
                aria-controls="global-search-results"
                aria-activedescendant={activeResult?.id}
              />
            </div>
            <button
              type="button"
              onClick={closeDialog}
              className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-theme bg-theme-inset text-theme-secondary transition hover:bg-theme-hover hover:text-theme-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/15"
              aria-label="Close global search"
            >
              <UiIcon name="close" className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-theme-subtle">
            <span>Use arrow keys to move, Enter to open.</span>
            <span>Esc closes</span>
          </div>
        </div>

        <div
          id="global-search-results"
          className="min-h-0 flex-1 overflow-y-auto p-2"
          role="listbox"
          aria-label="Global search results"
        >
          {loading && (
            <p className="rounded-xl border border-theme bg-theme-inset px-3 py-2 text-sm font-semibold text-theme-secondary">
              Searching...
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-theme-danger"
            >
              {error}
            </p>
          )}
          {!loading &&
            !error &&
            query.trim().length >= SEARCH_MIN_LENGTH &&
            flatResults.length === 0 && (
              <div className="px-4 py-10 text-center">
                <UiIcon
                  name="search"
                  className="mx-auto h-8 w-8 text-theme-accent"
                />
                <p className="mt-3 text-sm font-black text-theme-primary">
                  No results found
                </p>
                <p className="mt-1 text-sm text-theme-muted">
                  Try an item name, SKU, supplier, category, or movement note.
                </p>
              </div>
            )}
          {query.trim().length < SEARCH_MIN_LENGTH && (
            <p className="px-3 py-2 text-xs font-semibold text-theme-muted">
              Type at least 2 characters to search. Quick actions are available
              below.
            </p>
          )}
          {groupedResults.map(([group, groupItems]) => (
            <section key={group} className="py-2" aria-label={group}>
              <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-theme-subtle">
                {group}
              </p>
              <div className="grid gap-1">
                {groupItems.map((result) => {
                  const resultIndex = flatResults.findIndex(
                    (item) => item.id === result.id
                  );
                  const active = resultIndex === activeIndex;

                  return (
                    <button
                      key={result.id}
                      id={result.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(resultIndex)}
                      onClick={() => openResult(result)}
                      className={cx(
                        "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/15",
                        active ? "bg-theme-selected" : "hover:bg-theme-hover"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-theme-primary">
                          {result.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-theme-muted">
                          {result.subtitle}
                        </span>
                      </span>
                      <span
                        className={cx(
                          "shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
                          result.tone === "success" &&
                            "border-emerald-400/30 bg-emerald-500/10 text-theme-success",
                          result.tone === "warning" &&
                            "border-amber-300/30 bg-amber-500/10 text-theme-warning",
                          result.tone === "danger" &&
                            "border-red-400/30 bg-red-500/10 text-theme-danger",
                          result.tone === "accent" &&
                            "border-cyan-300/30 bg-cyan-500/10 text-theme-accent",
                          (!result.tone || result.tone === "default") &&
                            "border-theme bg-theme-inset text-theme-secondary"
                        )}
                      >
                        {result.chip}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
