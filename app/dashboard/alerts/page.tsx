"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductThumbnail from "@/components/inventory/ProductThumbnail";
import UiIcon from "@/components/UiIcon";
import { buttonClassName, useToast } from "@/components/ui";
import {
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import ItemDetailsSlideOver, {
  type SlideOverInventoryItem,
} from "@/components/inventory/ItemDetailsSlideOver";
import StockMovementDialog from "@/components/inventory/StockMovementDialog";
import type { StockMovement } from "@/app/lib/stockMovements";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { getDepotsForUser, type Depot } from "@/app/lib/depots";
import { getSuppliersForUser, type Supplier } from "@/app/lib/suppliers";
import {
  getEffectiveItemLowStockThreshold,
  getInventoryUnitLabel,
} from "@/app/lib/inventoryItemModel";
import { createPurchaseOrder, getNextPoNumber } from "@/app/lib/purchaseOrders";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getEffectivePlan,
  getSubscriptionCapabilities,
  getSubscriptionUsage,
  type UserSubscription,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";
import { getBusinessUser } from "@/app/lib/business";

/*
 * Stock alerts (redesign 8 Oct 2026, Sayed's spec + screenshots).
 *
 * Everything at or below its alert level, with a suggested order per row
 * (enough to reach twice the alert level), a selection that becomes one
 * draft purchase order per supplier, and an inline panel per row for the
 * alert level, a 7-day snooze (phase 39) and the supplier link.
 */

interface AlertItem {
  id: number;
  name: string;
  quantity: number;
  image: string;
  sku?: string | null;
  item_code?: string | null;
  min_stock_level?: number | null;
  depot_id?: number | null;
  supplier_id?: number | null;
  cost_price?: number | string | null;
  unit_type?: string | null;
  custom_unit_label?: string | null;
  alert_snoozed_until?: string | null;
}

type Tab = "all" | "out" | "low" | "nosupplier";
type Sort = "urgent" | "name" | "shortfall";

interface Entry {
  item: AlertItem;
  quantity: number;
  level: number;
  state: "out" | "low";
  suggested: number;
}

const TAB_LABEL: Record<Tab, string> = {
  all: "All",
  out: "Out of stock",
  low: "Low stock",
  nosupplier: "No supplier",
};

const SORT_LABEL: Record<Sort, string> = {
  urgent: "Most urgent",
  name: "Name",
  shortfall: "Biggest shortfall",
};

const INITIAL_TINTS = [
  ["#fff1e6", "#b54708"],
  ["#eef2ff", "#2447d6"],
  ["#ecfdf3", "#0f7a4f"],
  ["#f4f3ff", "#6d4ad6"],
  ["#e6f6f9", "#0b6e85"],
  ["#f2f4f7", "#475467"],
];

function tintFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return INITIAL_TINTS[hash % INITIAL_TINTS.length];
}

/** Counts up from 0 the first time a value arrives (~600ms), then follows it. */
function useCountUp(value: number, ready: boolean) {
  const [shown, setShown] = useState(0);
  const playedRef = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (playedRef.current || reduce) {
      playedRef.current = true;
       
      setShown(value);
      return;
    }
    playedRef.current = true;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 600);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ready, value]);
  return shown;
}

function readQuery() {
  if (typeof window === "undefined") return { tab: "all" as Tab, sort: "urgent" as Sort, q: "", depot: "" };
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const sort = params.get("sort");
  return {
    tab: (tab === "out" || tab === "low" || tab === "nosupplier" ? tab : "all") as Tab,
    sort: (sort === "name" || sort === "shortfall" ? sort : "urgent") as Sort,
    q: params.get("q") || "",
    depot: params.get("depot") || "",
  };
}

function KpiCard({
  label,
  value,
  hint,
  dot,
  active,
  ready,
  delay,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  dot: string;
  active: boolean;
  ready: boolean;
  delay: number;
  onClick: () => void;
}) {
  const shown = useCountUp(value, ready);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`alerts-v2-kpi motion-enter ${active ? "is-active" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="alerts-v2-kpi-top">
        {label}
        <span className="alerts-v2-dot" style={{ background: dot }} aria-hidden />
      </span>
      <strong>{ready ? shown : "—"}</strong>
      <small>{hint}</small>
    </button>
  );
}

export default function StockAlertsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [subscription, setSubscription] = useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("urgent");
  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState("");

  const [orderQty, setOrderQty] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openPanel, setOpenPanel] = useState<number | null>(null);
  const [panelLevel, setPanelLevel] = useState("");
  const [panelSupplier, setPanelSupplier] = useState("");
  const [panelBusy, setPanelBusy] = useState(false);
  const [bulkLevelOpen, setBulkLevelOpen] = useState(false);
  const [bulkLevel, setBulkLevel] = useState("10");
  const [confirmUnassigned, setConfirmUnassigned] = useState(false);
  const [creating, setCreating] = useState(false);
  const [movementItemId, setMovementItemId] = useState<number | null>(null);
  const [detailsItemId, setDetailsItemId] = useState<number | null>(null);
  const [nowMs] = useState(() => Date.now());

  // Filters live in the URL so a link or a reload keeps them.
  useEffect(() => {
    const query = readQuery();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the URL query after mount */
    setTab(query.tab);
    setSort(query.sort);
    setSearch(query.q);
    setDepotFilter(query.depot);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams();
    if (tab !== "all") params.set("tab", tab);
    if (sort !== "urgent") params.set("sort", sort);
    if (search.trim()) params.set("q", search.trim());
    if (depotFilter) params.set("depot", depotFilter);
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(window.history.state, "", next);
  }, [depotFilter, loading, search, sort, tab]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const {
        data: { user },
      } = await getBusinessUser();
      if (!user) throw new Error("Please sign in again to view stock alerts.");

      const [{ data: rows, error: itemError }, usage, loadedSettings, loadedDepots, loadedSuppliers] =
        await Promise.all([
          supabase
            .from("inventory")
            .select(
              "id, name, quantity, image, sku, item_code, min_stock_level, depot_id, supplier_id, cost_price, unit_type, custom_unit_label, alert_snoozed_until"
            )
            .eq("user_id", user.id)
            .order("name", { ascending: true }),
          getSubscriptionUsage(user.id),
          getOrCreateBusinessSettings(user.id),
          getDepotsForUser(user.id).catch(() => [] as Depot[]),
          getSuppliersForUser(user.id).catch(() => [] as Supplier[]),
        ]);
      if (itemError) throw itemError;
      return { user, rows: (rows || []) as AlertItem[], usage, loadedSettings, loadedDepots, loadedSuppliers };
    };

    load()
      .then((result) => {
        if (!active) return;
        setUserId(result.user.id);
        setItems(result.rows);
        setSubscription(result.usage.subscription);
        setSettings(result.loadedSettings);
        setDepots(result.loadedDepots);
        setSuppliers(result.loadedSuppliers);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "We could not load stock alerts.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const capabilities = getSubscriptionCapabilities(subscription);
  const canUseItemLevel = capabilities.customLowStockThreshold;
  const defaultLevel = getEffectiveLowStockThreshold(subscription, settings.low_stock_threshold);
  const depotById = useMemo(() => new Map(depots.map((depot) => [depot.id, depot])), [depots]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);

  const levelFor = useCallback(
    (item: AlertItem) =>
      canUseItemLevel ? getEffectiveItemLowStockThreshold(item.min_stock_level, defaultLevel) : defaultLevel,
    [canUseItemLevel, defaultLevel]
  );

  /** Every alerted item that is not snoozed. */
  const entries = useMemo<Entry[]>(() => {
    return items
      .filter((item) => !item.alert_snoozed_until || new Date(item.alert_snoozed_until).getTime() <= nowMs)
      .map((item) => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const level = levelFor(item);
        const state = quantity <= 0 ? ("out" as const) : quantity <= level ? ("low" as const) : null;
        return state ? { item, quantity, level, state, suggested: Math.max(level * 2 - quantity, 1) } : null;
      })
      .filter((entry): entry is Entry => entry !== null);
  }, [items, levelFor, nowMs]);

  const qtyFor = useCallback((entry: Entry) => orderQty[entry.item.id] ?? entry.suggested, [orderQty]);

  const counts = useMemo(
    () => ({
      all: entries.length,
      out: entries.filter((entry) => entry.state === "out").length,
      low: entries.filter((entry) => entry.state === "low").length,
      nosupplier: entries.filter((entry) => !entry.item.supplier_id).length,
      units: entries.reduce((sum, entry) => sum + qtyFor(entry), 0),
    }),
    [entries, qtyFor]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = entries.filter((entry) => {
      if (tab === "out" && entry.state !== "out") return false;
      if (tab === "low" && entry.state !== "low") return false;
      if (tab === "nosupplier" && entry.item.supplier_id) return false;
      if (depotFilter && String(entry.item.depot_id || "") !== depotFilter) return false;
      if (term) {
        const haystack = `${entry.item.name} ${entry.item.item_code || ""} ${entry.item.sku || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "name") return a.item.name.localeCompare(b.item.name);
      if (sort === "shortfall") return b.level - b.quantity - (a.level - a.quantity);
      const ratioA = a.level > 0 ? a.quantity / a.level : 0;
      const ratioB = b.level > 0 ? b.quantity / b.level : 0;
      return ratioA - ratioB || a.item.name.localeCompare(b.item.name);
    });
  }, [depotFilter, entries, search, sort, tab]);

  const selectedEntries = entries.filter((entry) => selected.has(entry.item.id));
  const selectedUnits = selectedEntries.reduce((sum, entry) => sum + qtyFor(entry), 0);
  const allVisibleSelected = visible.length > 0 && visible.every((entry) => selected.has(entry.item.id));

  const toggle = (id: number) => {
    setConfirmUnassigned(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setConfirmUnassigned(false);
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((entry) => next.delete(entry.item.id));
      else visible.forEach((entry) => next.add(entry.item.id));
      return next;
    });
  };

  const setQty = (entry: Entry, value: number) => {
    setOrderQty((current) => ({ ...current, [entry.item.id]: Math.max(1, Math.min(99999, Math.round(value) || 1)) }));
  };

  const openRowPanel = (entry: Entry) => {
    if (openPanel === entry.item.id) {
      setOpenPanel(null);
      return;
    }
    setOpenPanel(entry.item.id);
    setPanelLevel(String(entry.item.min_stock_level ?? entry.level));
    setPanelSupplier(entry.item.supplier_id ? String(entry.item.supplier_id) : "");
  };

  /* ---------------- saves ---------------- */

  const updateItem = async (item: AlertItem, patch: Partial<AlertItem>, label: string) => {
    if (!userId) return false;
    const { data, error: updateError } = await supabase
      .from("inventory")
      .update(patch)
      .eq("id", item.id)
      .eq("user_id", userId)
      .select("id");
    if (updateError || !data?.length) {
      showToast({ tone: "danger", message: `${label} could not be saved. Please try again.` });
      return false;
    }
    const oldValues: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) oldValues[key] = item[key as keyof AlertItem] ?? null;
    await logInventoryHistory({
      itemId: item.id,
      userId,
      action: "edited",
      oldValues,
      newValues: patch as Record<string, unknown>,
    });
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)));
    return true;
  };

  const saveLevel = async (entry: Entry) => {
    const level = Number(panelLevel);
    if (!Number.isInteger(level) || level < 0) {
      showToast({ tone: "danger", message: "The alert level must be a whole number of 0 or more." });
      return;
    }
    setPanelBusy(true);
    const ok = await updateItem(entry.item, { min_stock_level: level }, "The alert level");
    setPanelBusy(false);
    if (ok) {
      setOrderQty((current) => {
        const next = { ...current };
        delete next[entry.item.id];
        return next;
      });
      showToast({ tone: "success", message: `${entry.item.name}: alert level ${level}` });
    }
  };

  const snooze = async (entry: Entry) => {
    setPanelBusy(true);
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ok = await updateItem(entry.item, { alert_snoozed_until: until }, "The snooze");
    setPanelBusy(false);
    if (ok) {
      setOpenPanel(null);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(entry.item.id);
        return next;
      });
      showToast({ tone: "success", message: `${entry.item.name} snoozed for 7 days` });
    }
  };

  const saveSupplier = async (entry: Entry) => {
    const supplierId = panelSupplier ? Number(panelSupplier) : null;
    if (supplierId === (entry.item.supplier_id ?? null)) return;
    setPanelBusy(true);
    const ok = await updateItem(entry.item, { supplier_id: supplierId }, "The supplier");
    setPanelBusy(false);
    if (ok) {
      showToast({
        tone: "success",
        message: supplierId ? `${entry.item.name} linked to ${supplierById.get(supplierId)?.name}` : "Supplier removed",
      });
    }
  };

  const applyBulkLevel = async () => {
    const level = Number(bulkLevel);
    if (!Number.isInteger(level) || level < 0) {
      showToast({ tone: "danger", message: "The alert level must be a whole number of 0 or more." });
      return;
    }
    setCreating(true);
    let done = 0;
    for (const entry of selectedEntries) {
      if (await updateItem(entry.item, { min_stock_level: level }, "An alert level")) done += 1;
    }
    setCreating(false);
    setBulkLevelOpen(false);
    if (done) showToast({ tone: "success", message: `Alert level ${level} set on ${done} ${done === 1 ? "item" : "items"}` });
  };

  /** One draft PO per supplier, in the base currency at each item's cost. */
  const createOrders = async () => {
    if (!userId || selectedEntries.length === 0 || creating) return;
    const unassigned = selectedEntries.filter((entry) => !entry.item.supplier_id);
    if (unassigned.length > 0 && !confirmUnassigned) {
      setConfirmUnassigned(true);
      return;
    }

    const groups = new Map<number | null, Entry[]>();
    for (const entry of selectedEntries) {
      const key = entry.item.supplier_id ?? null;
      groups.set(key, [...(groups.get(key) || []), entry]);
    }

    setCreating(true);
    const createdIds: number[] = [];
    try {
      for (const [supplierId, group] of groups) {
        const supplier = supplierId ? supplierById.get(supplierId) : null;
        const depotIds = new Set(group.map((entry) => entry.item.depot_id ?? null));
        const sharedDepot = depotIds.size === 1 ? depotById.get([...depotIds][0] as number) || null : null;
        const poNumber = await getNextPoNumber(userId, {
          depotCode: sharedDepot?.code,
          depotName: sharedDepot?.name,
          businessName: settings.business_name,
          poPrefix: settings.po_prefix,
        });
        const orderId = await createPurchaseOrder(
          userId,
          {
            po_number: poNumber,
            title: supplier ? `Restock · ${supplier.name}` : "Restock · Unassigned supplier",
            supplier_id: supplier?.id ?? null,
            supplier_name_snapshot: supplier?.name ?? null,
            supplier_contact_snapshot: supplier
              ? [supplier.contact_name, supplier.email, supplier.phone].filter(Boolean).join(" | ") || null
              : null,
            depot_id: sharedDepot?.id ?? null,
            depot_name_snapshot: sharedDepot?.name ?? null,
            purchase_date: new Date().toISOString().slice(0, 10),
            status: "draft",
            payment_status: "unpaid",
            amount_paid: 0,
            currency_code: settings.base_currency,
            exchange_rate: 1,
            notes: "Created from Stock alerts.",
          },
          group.map((entry) => ({
            line_type: "inventory" as const,
            inventory_item_id: entry.item.id,
            affects_stock: true,
            expense_category: null,
            name_snapshot: entry.item.name,
            sku_snapshot: entry.item.sku || null,
            item_code_snapshot: entry.item.item_code || null,
            unit_label_snapshot: getInventoryUnitLabel(entry.item.unit_type, entry.item.custom_unit_label),
            quantity: qtyFor(entry),
            unit_cost:
              entry.item.cost_price === null || entry.item.cost_price === undefined || entry.item.cost_price === ""
                ? 0
                : Number(entry.item.cost_price),
          }))
        );
        createdIds.push(orderId);
      }
    } catch (createError: unknown) {
      setCreating(false);
      showToast({
        tone: "danger",
        message:
          createdIds.length > 0
            ? `${createdIds.length} order(s) created, then one failed. Check Purchase orders.`
            : createError instanceof Error
              ? createError.message
              : "The purchase order could not be created.",
      });
      return;
    }

    showToast({
      tone: "success",
      message: `${createdIds.length} draft purchase ${createdIds.length === 1 ? "order" : "orders"} created`,
    });
    router.push(
      createdIds.length === 1 ? `/dashboard/purchase-orders?open=${createdIds[0]}` : "/dashboard/purchase-orders"
    );
  };

  /* ---------------- render ---------------- */

  const handleMovementRecorded = (movement: StockMovement, itemId: number) => {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, quantity: movement.quantity_after } : item)));
    showToast({ tone: "success", message: "Stock received." });
  };

  const handleSlideOverItemUpdated = (updated: SlideOverInventoryItem) => {
    setItems((current) =>
      current.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              name: updated.name,
              quantity: updated.quantity,
              image: updated.image,
              sku: updated.sku || null,
              item_code: updated.item_code || null,
              min_stock_level: updated.min_stock_level ?? null,
              depot_id: updated.depot_id ?? null,
            }
          : item
      )
    );
  };

  const movementEntry = entries.find((entry) => entry.item.id === movementItemId);
  const unassignedSelected = selectedEntries.filter((entry) => !entry.item.supplier_id).length;
  const supplierGroups = new Set(selectedEntries.map((entry) => entry.item.supplier_id ?? null)).size;

  return (
    <main className="insights-workspace alerts-v2">
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Insights"
          title="Stock alerts"
          description={
            loading
              ? "Checking your stock levels…"
              : counts.all === 0
                ? "Nothing is at or below its alert level."
                : `${counts.out} out of stock and ${counts.low} running low. Pick what to reorder and create one purchase order.`
          }
          actions={
            <>
              <Link href="/dashboard/settings?section=notifications" className={buttonClassName({ variant: "secondary" })}>
                <UiIcon name="bell" className="h-4 w-4" />
                Notify me
              </Link>
              <button
                type="button"
                disabled={loading || entries.length === 0}
                onClick={() => {
                  setTab("all");
                  setSelected(new Set(entries.map((entry) => entry.item.id)));
                }}
                className={buttonClassName()}
              >
                <UiIcon name="cart" className="h-4 w-4" />
                Reorder all alerts
              </button>
            </>
          }
        />

        {error && <DashboardNotice tone="danger">{error}</DashboardNotice>}

        <section className="alerts-v2-kpis">
          <KpiCard label="Out of stock" value={counts.out} hint="Nothing left on the shelf" dot="#d92d20" active={tab === "out"} ready={!loading} delay={0} onClick={() => setTab(tab === "out" ? "all" : "out")} />
          <KpiCard label="Low stock" value={counts.low} hint="At or below alert level" dot="#f79009" active={tab === "low"} ready={!loading} delay={50} onClick={() => setTab(tab === "low" ? "all" : "low")} />
          <KpiCard label="Units to reorder" value={counts.units} hint="Suggested to reach 2× alert level" dot="#2447d6" active={false} ready={!loading} delay={100} onClick={() => setTab("all")} />
          <KpiCard label="No supplier linked" value={counts.nosupplier} hint="Can't auto-create a PO" dot="#c4320a" active={tab === "nosupplier"} ready={!loading} delay={150} onClick={() => setTab(tab === "nosupplier" ? "all" : "nosupplier")} />
        </section>

        <section className="alerts-v2-card motion-enter" style={{ animationDelay: "120ms" }}>
          <div className="alerts-v2-toolbar">
            <div className="alerts-v2-tabs" role="tablist" aria-label="Filter alerts">
              {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tab === key ? "is-active" : ""}>
                  {TAB_LABEL[key]} <span>{counts[key]}</span>
                </button>
              ))}
            </div>
            <label className="alerts-v2-search">
              <UiIcon name="search" className="h-4 w-4" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item or code" aria-label="Search alerts" />
            </label>
            <label className="alerts-v2-select">
              <span>Depot</span>
              <select value={depotFilter} onChange={(event) => setDepotFilter(event.target.value)} aria-label="Depot">
                <option value="">All depots</option>
                {depots.map((depot) => (
                  <option key={depot.id} value={depot.id}>
                    {depot.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="alerts-v2-select">
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort">
                {(Object.keys(SORT_LABEL) as Sort[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABEL[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <LoadingSkeletonGroup count={4} className="p-4" itemClassName="min-h-16" />
          ) : visible.length === 0 ? (
            <div className="alerts-v2-empty">
              <span aria-hidden>
                <UiIcon name="check" className="h-6 w-6" />
              </span>
              <p className="alerts-v2-empty-title">{entries.length === 0 ? "All stocked up" : "Nothing matches"}</p>
              <p>{entries.length === 0 ? "Every item is above its alert level." : "Try another tab, depot or search."}</p>
            </div>
          ) : (
            <div className="alerts-v2-table" role="table" aria-label="Stock alerts">
              <div className="alerts-v2-head" role="row">
                <span role="columnheader">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all" />
                </span>
                <span role="columnheader">Item</span>
                <span role="columnheader">Stock vs alert level</span>
                <span role="columnheader">Suggested order</span>
                <span role="columnheader" className="is-right">
                  Actions
                </span>
              </div>

              {visible.map((entry, index) => {
                const { item } = entry;
                const isSelected = selected.has(item.id);
                const depot = item.depot_id ? depotById.get(item.depot_id) : null;
                const supplier = item.supplier_id ? supplierById.get(item.supplier_id) : null;
                const [tintBg, tintFg] = tintFor(item.name);
                const ratio = entry.level > 0 ? Math.min(entry.quantity / entry.level, 1) : 0;
                const delay = index < 10 ? 150 + index * 50 : 0;
                const qty = qtyFor(entry);
                return (
                  <Fragment key={item.id}>
                    <div
                      role="row"
                      className={`alerts-v2-row ${isSelected ? "is-selected" : ""} ${index < 10 ? "motion-enter" : ""}`}
                      style={index < 10 ? { animationDelay: `${delay}ms` } : undefined}
                    >
                      <span role="cell">
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(item.id)} aria-label={`Select ${item.name}`} />
                      </span>
                      <span role="cell" className="alerts-v2-item">
                        <span className="alerts-v2-thumb" style={item.image ? undefined : { background: tintBg, color: tintFg }}>
                          {item.image ? (
                            <ProductThumbnail src={item.image} alt="" sizes="44px" imgClassName="object-cover" iconClassName="h-5 w-5" fallbackClassName="flex h-full w-full items-center justify-center" />
                          ) : (
                            item.name.trim().charAt(0).toUpperCase() || "?"
                          )}
                        </span>
                        <span className="alerts-v2-item-text">
                          <button type="button" onClick={() => setDetailsItemId(item.id)} className="alerts-v2-name">
                            {item.name}
                          </button>
                          <small>
                            <span className="is-mono">{item.item_code || item.sku || "No code"}</span>
                            {" · "}
                            {depot ? `${depot.name}${depot.code ? ` (${depot.code})` : ""}` : "Unassigned"}
                            {" · "}
                            {supplier ? supplier.name : <span className="is-warn">No supplier</span>}
                          </small>
                        </span>
                      </span>
                      <span role="cell" className="alerts-v2-stock">
                        <span className="alerts-v2-stock-top">
                          <span className={`alerts-v2-status is-${entry.state}`}>
                            <span className="alerts-v2-status-dot" aria-hidden />
                            {entry.state === "out" ? "Out of stock" : `${entry.quantity} left · ${entry.level - entry.quantity} under level`}
                          </span>
                          <span className="alerts-v2-ratio">
                            <b className="is-mono">{entry.quantity}</b> / alert {entry.level}
                          </span>
                        </span>
                        <span className="alerts-v2-bar" aria-hidden>
                          <i className={`is-${entry.state}`} style={{ width: `${Math.max(ratio * 100, entry.state === "out" ? 0 : 4)}%`, animationDelay: `${delay}ms` }} />
                        </span>
                      </span>
                      <span role="cell" className="alerts-v2-stepper">
                        <button type="button" onClick={() => setQty(entry, qty - 1)} disabled={qty <= 1} aria-label={`Order one less ${item.name}`}>
                          −
                        </button>
                        <input value={qty} inputMode="numeric" onChange={(event) => setQty(entry, Number(event.target.value.replace(/\D/g, "")))} aria-label={`Order quantity for ${item.name}`} />
                        <button type="button" onClick={() => setQty(entry, qty + 1)} aria-label={`Order one more ${item.name}`}>
                          +
                        </button>
                      </span>
                      <span role="cell" className="alerts-v2-actions">
                        <button type="button" onClick={() => setMovementItemId(item.id)} className={buttonClassName({ variant: "secondary" })}>
                          <UiIcon name="download" className="h-4 w-4" />
                          Receive
                        </button>
                        <button type="button" onClick={() => toggle(item.id)} aria-pressed={isSelected} className={`${buttonClassName()} alerts-v2-order-btn`}>
                          {isSelected ? (
                            <>
                              <UiIcon name="check" className="h-4 w-4" /> In order
                            </>
                          ) : (
                            "Add to order"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openRowPanel(entry)}
                          aria-expanded={openPanel === item.id}
                          aria-label={`More for ${item.name}`}
                          className={`${buttonClassName({ variant: "secondary" })} alerts-v2-more`}
                        >
                          <UiIcon name="more" className="h-4 w-4" />
                        </button>
                      </span>
                    </div>

                    {openPanel === item.id && (
                      <div className="alerts-v2-panel" role="region" aria-label={`Settings for ${item.name}`}>
                        {canUseItemLevel ? (
                          <span className="alerts-v2-panel-group">
                            <span className="alerts-v2-panel-label">Alert level</span>
                            <span className="alerts-v2-stepper is-small">
                              <button type="button" onClick={() => setPanelLevel(String(Math.max(0, (Number(panelLevel) || 0) - 1)))} aria-label="Lower alert level">
                                −
                              </button>
                              <input value={panelLevel} inputMode="numeric" onChange={(event) => setPanelLevel(event.target.value.replace(/\D/g, ""))} aria-label="Alert level" />
                              <button type="button" onClick={() => setPanelLevel(String((Number(panelLevel) || 0) + 1))} aria-label="Raise alert level">
                                +
                              </button>
                            </span>
                            <button type="button" disabled={panelBusy} onClick={() => void saveLevel(entry)} className={buttonClassName({ size: "sm" })}>
                              Save
                            </button>
                          </span>
                        ) : (
                          <span className="alerts-v2-panel-group">
                            <span className="alerts-v2-panel-label">Alert level {defaultLevel}</span>
                            <span className="alerts-v2-muted">Per-item levels need a paid plan ({formatPlanName(getEffectivePlan(subscription))} now).</span>
                          </span>
                        )}
                        <span className="alerts-v2-panel-sep" aria-hidden />
                        <button type="button" disabled={panelBusy} onClick={() => void snooze(entry)} className={buttonClassName({ variant: "secondary", size: "sm" })}>
                          Snooze 7 days
                        </button>
                        <span className="alerts-v2-panel-group">
                          <select value={panelSupplier} onChange={(event) => setPanelSupplier(event.target.value)} aria-label="Supplier" className="ui-input alerts-v2-panel-select">
                            <option value="">No supplier</option>
                            {suppliers.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={panelBusy || (panelSupplier ? Number(panelSupplier) : null) === (item.supplier_id ?? null)}
                            onClick={() => void saveSupplier(entry)}
                            className={buttonClassName({ variant: "secondary", size: "sm" })}
                          >
                            Link supplier
                          </button>
                          {suppliers.length === 0 && (
                            <Link href="/dashboard/suppliers" className="alerts-v2-link">
                              Add a supplier
                            </Link>
                          )}
                        </span>
                        <Link href={`/dashboard/inventory/${item.id}?returnTo=${encodeURIComponent("/dashboard/alerts")}`} className="alerts-v2-link">
                          Open item →
                        </Link>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </section>

        <section className="alerts-v2-settings">
          <span className="alerts-v2-settings-icon" aria-hidden>
            <UiIcon name="settings" className="h-5 w-5" />
          </span>
          <span className="alerts-v2-settings-text">
            <strong>
              Default alert level: <span className="is-mono">{defaultLevel}</span>
            </strong>
            <small>Used when an item has no level of its own.{canUseItemLevel ? "" : " Fixed on your current plan."}</small>
          </span>
          <Link href="/dashboard/settings" className={buttonClassName({ variant: "secondary" })}>
            Alert settings
          </Link>
        </section>

        {/* Room for the bulk bar so it never covers the last row. */}
        {selected.size > 0 && <div className="alerts-v2-bulk-spacer" aria-hidden />}
      </DashboardPageShell>

      {selected.size > 0 && (
        <div className="alerts-v2-bulk" role="region" aria-label="Selected alerts">
          {confirmUnassigned ? (
            <>
              <span className="alerts-v2-bulk-text">
                <strong>{unassignedSelected} without a supplier</strong>
                <span>They go into one &quot;Unassigned supplier&quot; draft. Continue?</span>
              </span>
              <button type="button" onClick={() => setConfirmUnassigned(false)} className="alerts-v2-bulk-ghost">
                Back
              </button>
              <button type="button" disabled={creating} onClick={() => void createOrders()} className={buttonClassName()}>
                {creating ? "Creating…" : `Create ${supplierGroups} ${supplierGroups === 1 ? "draft" : "drafts"} →`}
              </button>
            </>
          ) : bulkLevelOpen ? (
            <>
              <span className="alerts-v2-bulk-text">
                <strong>Alert level for {selected.size}</strong>
              </span>
              <input value={bulkLevel} onChange={(event) => setBulkLevel(event.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Alert level for selected" className="alerts-v2-bulk-input" />
              <button type="button" onClick={() => setBulkLevelOpen(false)} className="alerts-v2-bulk-ghost">
                Cancel
              </button>
              <button type="button" disabled={creating} onClick={() => void applyBulkLevel()} className={buttonClassName()}>
                {creating ? "Saving…" : "Apply"}
              </button>
            </>
          ) : (
            <>
              <span className="alerts-v2-bulk-text">
                <strong>{selected.size} selected</strong>
                <span>{selectedUnits} units to order</span>
              </span>
              <button type="button" onClick={() => setSelected(new Set())} className="alerts-v2-bulk-ghost">
                Clear
              </button>
              {canUseItemLevel && (
                <button type="button" onClick={() => setBulkLevelOpen(true)} className={buttonClassName({ variant: "secondary" })}>
                  Set alert level
                </button>
              )}
              <button type="button" disabled={creating} onClick={() => void createOrders()} className={buttonClassName()}>
                {creating ? "Creating…" : "Create purchase order →"}
              </button>
            </>
          )}
        </div>
      )}

      {detailsItemId && (
        <ItemDetailsSlideOver
          itemId={detailsItemId}
          initialTab="alerts"
          returnTo="/dashboard/alerts"
          onClose={() => setDetailsItemId(null)}
          onItemUpdated={handleSlideOverItemUpdated}
        />
      )}

      <StockMovementDialog
        open={movementItemId !== null}
        items={items}
        initialItemId={movementItemId}
        initialQuantity={movementEntry ? qtyFor(movementEntry) : null}
        onClose={() => setMovementItemId(null)}
        onRecorded={handleMovementRecorded}
      />
    </main>
  );
}
