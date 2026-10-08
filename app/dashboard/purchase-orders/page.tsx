"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui";
import Select from "@/components/ui/Select";
import UiIcon from "@/components/UiIcon";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { getBusinessUser } from "@/app/lib/business";
import { supabase } from "@/app/lib/supabase";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { formatExactPrice, getCurrencyContext } from "@/app/lib/currency";
import { getEffectiveItemLowStockThreshold } from "@/app/lib/inventoryItemModel";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";
import {
  formatPurchaseOrderAmount,
  getPurchaseOrderBalanceInBase,
  getPurchaseOrderReceivingProgress,
  getPurchaseOrderSplit,
  getPurchaseOrderTotal,
  getPurchaseOrdersForUser,
  isPurchaseOrdersSchemaMissing,
  toPurchaseOrderBase,
  type PurchaseOrder,
} from "@/app/lib/purchaseOrders";

/*
 * Purchase orders list (redesign 9 Oct 2026, Sayed's PO spec). Four figures,
 * status tabs, search + depot + supplier filters kept in the URL, rows
 * grouped by month with a receiving bar, the payment state and the one next
 * step for that order. A row opens the order's own page.
 */

type Tab = "all" | "draft" | "receive" | "received" | "cancelled";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "receive", label: "To receive" },
  { id: "received", label: "Received" },
  { id: "cancelled", label: "Cancelled" },
];

function inTab(order: PurchaseOrder, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "draft") return order.status === "draft";
  if (tab === "receive") return order.status === "ordered" || order.status === "partially_received";
  if (tab === "received") return order.status === "received";
  return order.status === "cancelled";
}

function orderDate(order: PurchaseOrder) {
  return order.purchase_date || order.created_at.slice(0, 10);
}

function shortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(key: string) {
  const date = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? key : new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
}

function stage(order: PurchaseOrder) {
  switch (order.status) {
    case "draft":
      return { label: "Draft", tone: "draft" };
    case "ordered":
      return { label: "Ordered", tone: "ordered" };
    case "partially_received":
      return { label: "Partly received", tone: "partial" };
    case "received":
      return { label: order.closed_short ? "Closed short" : "Received", tone: "received" };
    default:
      return { label: "Cancelled", tone: "cancelled" };
  }
}

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") as Tab | null;
  return {
    tab: tab && TABS.some((entry) => entry.id === tab) ? tab : ("all" as Tab),
    q: params.get("q") || "",
    depot: params.get("depot") || "",
    supplier: params.get("supplier") || "",
    open: Number(params.get("open")),
  };
}

function PurchaseOrdersList() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [subscription, setSubscription] = useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  // Old links (?open=12, e.g. from Stock alerts) go to the order's page.
  useEffect(() => {
    const query = readQuery();
    if (Number.isFinite(query.open) && query.open > 0) {
      router.replace(`/dashboard/purchase-orders/${query.open}`);
      return;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the URL query after mount */
    setTab(query.tab);
    setSearch(query.q);
    setDepotFilter(query.depot);
    setSupplierFilter(query.supplier);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    if (tab !== "all") params.set("tab", tab);
    if (search.trim()) params.set("q", search.trim());
    if (depotFilter) params.set("depot", depotFilter);
    if (supplierFilter) params.set("supplier", supplierFilter);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
  }, [depotFilter, ready, search, supplierFilter, tab]);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await getBusinessUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const [loadedSettings, loadedSubscription, inventory] = await Promise.all([
        getOrCreateBusinessSettings(user.id),
        getUserSubscription(user.id),
        supabase.from("inventory").select("quantity, min_stock_level, alert_snoozed_until").eq("user_id", user.id),
      ]);
      if (!active) return;
      setSettings(loadedSettings);
      setSubscription(loadedSubscription);

      // Same rule as Stock alerts: at or below the alert level, not snoozed.
      const capabilities = getSubscriptionCapabilities(loadedSubscription);
      const fallback = getEffectiveLowStockThreshold(loadedSubscription, loadedSettings.low_stock_threshold);
      const now = Date.now();
      const alerts = ((inventory.data || []) as Array<{ quantity: number; min_stock_level: number | null; alert_snoozed_until: string | null }>).filter((row) => {
        if (row.alert_snoozed_until && new Date(row.alert_snoozed_until).getTime() > now) return false;
        const level = capabilities.customLowStockThreshold ? getEffectiveItemLowStockThreshold(row.min_stock_level, fallback) : fallback;
        return Number(row.quantity) <= level;
      }).length;
      setAlertCount(alerts);

      try {
        const loadedOrders = await getPurchaseOrdersForUser(user.id);
        if (active) setOrders(loadedOrders);
      } catch (loadError) {
        if (!active) return;
        if (isPurchaseOrdersSchemaMissing(loadError)) setSchemaMissing(true);
        else setError("Purchase orders could not be loaded. Refresh and try again.");
      }
      if (active) setLoading(false);
    })().catch(() => {
      if (!active) return;
      setError("Purchase orders could not be loaded. Refresh and try again.");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const base = getCurrencyContext().base;
  const baseMoney = (value: number) => formatExactPrice(value, base) || "—";

  const figures = useMemo(() => {
    const open = orders.filter((order) => order.status === "ordered" || order.status === "partially_received");
    const toReceive = open.reduce((sum, order) => sum + getPurchaseOrderReceivingProgress(order).remaining, 0);
    const unpaid = orders.filter((order) => order.status !== "cancelled" && order.status !== "draft" && getPurchaseOrderBalanceInBase(order).remaining > 0.004);
    const unpaidTotal = unpaid.reduce((sum, order) => sum + getPurchaseOrderBalanceInBase(order).remaining, 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthOrders = orders.filter((order) => order.status !== "cancelled" && order.status !== "draft" && monthKey(orderDate(order)) === thisMonth);
    let stock = 0;
    let general = 0;
    for (const order of monthOrders) {
      const split = getPurchaseOrderSplit(order);
      stock += toPurchaseOrderBase(order, split.inventoryTotal);
      general += toPurchaseOrderBase(order, split.expenseTotal);
    }
    const charges = monthOrders.reduce((sum, order) => sum + toPurchaseOrderBase(order, order.delivery_fee - order.discount), 0);
    return {
      openCount: open.length,
      toReceive,
      toReceiveOrders: open.filter((order) => getPurchaseOrderReceivingProgress(order).remaining > 0).length,
      unpaidTotal,
      unpaidCount: unpaid.length,
      spent: Math.max(0, stock + general + charges),
      stock,
      general,
    };
  }, [orders]);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((entry) => [entry.id, orders.filter((order) => inTab(order, entry.id)).length])) as Record<Tab, number>,
    [orders]
  );

  const depotOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((order) => {
      if (order.depot_id) map.set(String(order.depot_id), order.depot_name_snapshot || `Depot ${order.depot_id}`);
    });
    return [{ value: "", label: "All" }, ...[...map].map(([value, label]) => ({ value, label }))];
  }, [orders]);

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((order) => {
      const name = order.supplier_name_snapshot;
      if (name) map.set(order.supplier_id ? String(order.supplier_id) : `name:${name}`, name);
    });
    return [{ value: "", label: "All" }, ...[...map].map(([value, label]) => ({ value, label }))];
  }, [orders]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders
      .filter((order) => inTab(order, tab))
      .filter((order) => !depotFilter || String(order.depot_id || "") === depotFilter)
      .filter((order) =>
        !supplierFilter
          ? true
          : supplierFilter.startsWith("name:")
            ? order.supplier_name_snapshot === supplierFilter.slice(5)
            : String(order.supplier_id || "") === supplierFilter
      )
      .filter((order) => {
        if (!term) return true;
        const haystack = [
          order.po_number,
          order.title,
          order.supplier_name_snapshot,
          ...order.lines.map((line) => `${line.name_snapshot} ${line.item_code_snapshot || ""}`),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => orderDate(b).localeCompare(orderDate(a)) || b.id - a.id);
  }, [depotFilter, orders, search, supplierFilter, tab]);

  const groups = useMemo(() => {
    const map = new Map<string, PurchaseOrder[]>();
    visible.forEach((order) => {
      const key = monthKey(orderDate(order));
      map.set(key, [...(map.get(key) || []), order]);
    });
    return [...map];
  }, [visible]);

  const header = (
    <DashboardPageHeader
      eyebrow="Buying"
      title="Purchase orders"
      description="Order from suppliers, receive the goods, pay — all tracked in one place."
      actions={
        getSubscriptionCapabilities(subscription).purchaseOrders ? (
          <>
            <Link href="/dashboard/alerts" className={buttonClassName({ variant: "secondary" })}>
              From stock alerts
              {alertCount > 0 && <span className="pol-v2-count">{alertCount}</span>}
            </Link>
            <Link href="/dashboard/purchase-orders/new" className={buttonClassName()}>
              <UiIcon name="plus" className="h-4 w-4" />
              New purchase order
            </Link>
          </>
        ) : undefined
      }
    />
  );

  if (!loading && !getSubscriptionCapabilities(subscription).purchaseOrders) {
    return (
      <DashboardPageShell as="main">
        {header}
        <LockedFeaturePanel
          feature="Purchase orders"
          benefit="Record every purchase with its cost, payment status and invoice, then receive the stock straight into your depot."
          currentPlan={formatPlanName(subscription.plan)}
          requiredPlan="Standard"
          source="purchase-orders"
        />
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell as="main" className="pol-v2">
      {header}

      {error && <DashboardNotice tone="danger">{error}</DashboardNotice>}
      {schemaMissing && (
        <DashboardNotice tone="warning">
          Purchase orders are not set up in this database yet (sql/phase-8-purchase-orders.sql).
        </DashboardNotice>
      )}

      <section className="pol-v2-kpis">
        {[
          { label: "Open orders", value: String(figures.openCount), hint: "Waiting for goods", dot: "#2447d6", go: () => setTab("receive") },
          {
            label: "To receive",
            value: `${figures.toReceive} ${figures.toReceive === 1 ? "unit" : "units"}`,
            hint: `From ${figures.toReceiveOrders} ${figures.toReceiveOrders === 1 ? "order" : "orders"}`,
            dot: "#f79009",
            go: () => setTab("receive"),
          },
          {
            label: "Unpaid balance",
            value: baseMoney(figures.unpaidTotal),
            hint: `${figures.unpaidCount} ${figures.unpaidCount === 1 ? "order" : "orders"} not paid yet`,
            dot: "#d92d20",
            go: () => setTab("all"),
          },
          {
            label: "Spent this month",
            value: baseMoney(figures.spent),
            hint: `Stock ${baseMoney(figures.stock)} · General ${baseMoney(figures.general)}`,
            dot: "#12b76a",
            go: () => setTab("all"),
          },
        ].map((card, index) => (
          <button key={card.label} type="button" onClick={card.go} className="alerts-v2-kpi motion-enter" style={{ animationDelay: `${index * 50}ms` }}>
            <span className="alerts-v2-kpi-top">
              {card.label}
              <span className="alerts-v2-dot" style={{ background: card.dot }} aria-hidden />
            </span>
            <strong>{loading ? "—" : card.value}</strong>
            <small>{card.hint}</small>
          </button>
        ))}
      </section>

      <section className="alerts-v2-card motion-enter" style={{ animationDelay: "120ms" }}>
        <div className="alerts-v2-toolbar">
          <div className="alerts-v2-tabs" role="tablist" aria-label="Filter orders">
            {TABS.map((entry) => (
              <button key={entry.id} type="button" role="tab" aria-selected={tab === entry.id} onClick={() => setTab(entry.id)} className={tab === entry.id ? "is-active" : ""}>
                {entry.label} <span>{counts[entry.id] ?? 0}</span>
              </button>
            ))}
          </div>
          <label className="alerts-v2-search">
            <UiIcon name="search" className="h-4 w-4" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="PO number, supplier or item" aria-label="Search purchase orders" />
          </label>
          <Select ariaLabel="Depot" className="alerts-v2-dropdown" value={depotFilter} onChange={setDepotFilter} leadingIcon={<span className="alerts-v2-dropdown-label">Depot</span>} options={depotOptions} />
          <Select ariaLabel="Supplier" className="alerts-v2-dropdown" value={supplierFilter} onChange={setSupplierFilter} leadingIcon={<span className="alerts-v2-dropdown-label">Supplier</span>} options={supplierOptions} />
        </div>

        {loading ? (
          <LoadingSkeletonGroup count={4} className="p-4" itemClassName="min-h-16" />
        ) : visible.length === 0 ? (
          <div className="alerts-v2-empty">
            <span aria-hidden>
              <UiIcon name="cart" className="h-6 w-6" />
            </span>
            <p className="alerts-v2-empty-title">{orders.length === 0 ? "No purchase orders yet" : "Nothing matches"}</p>
            <p>{orders.length === 0 ? "Create one, or start from Stock alerts." : "Try another tab, depot, supplier or search."}</p>
            {orders.length === 0 && (
              <Link href="/dashboard/purchase-orders/new" className={buttonClassName({ className: "mt-3" })}>
                New purchase order
              </Link>
            )}
          </div>
        ) : (
          groups.map(([key, monthOrders]) => {
            const isCollapsed = collapsed.has(key);
            const monthTotal = monthOrders
              .filter((order) => order.status !== "cancelled")
              .reduce((sum, order) => sum + toPurchaseOrderBase(order, getPurchaseOrderTotal(order)), 0);
            return (
              <div key={key} className="pol-v2-month">
                <button
                  type="button"
                  className="pol-v2-month-head"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                >
                  <UiIcon name={isCollapsed ? "chevron-right" : "chevron-down"} className="h-4 w-4" />
                  <strong>{monthLabel(key)}</strong>
                  <span>
                    {monthOrders.length} {monthOrders.length === 1 ? "order" : "orders"} · {baseMoney(monthTotal)}
                  </span>
                </button>
                {!isCollapsed &&
                  monthOrders.map((order, index) => {
                    const progress = getPurchaseOrderReceivingProgress(order);
                    const st = stage(order);
                    const total = getPurchaseOrderTotal(order);
                    const missingCosts =
                      (order.status === "draft" || order.status === "ordered") &&
                      order.lines.some((line) => line.unit_cost === null || Number(line.unit_cost) === 0);
                    const balance = getPurchaseOrderBalanceInBase(order).remaining;
                    const action =
                      order.status === "draft"
                        ? { label: "Continue", href: `/dashboard/purchase-orders/new?edit=${order.id}` }
                        : missingCosts
                          ? { label: "Add costs", href: `/dashboard/purchase-orders/${order.id}` }
                          : order.status === "ordered" || order.status === "partially_received"
                            ? { label: "Receive", href: `/dashboard/purchase-orders/${order.id}?receive=1` }
                            : order.status === "received" && balance > 0.004
                              ? { label: "Pay", href: `/dashboard/purchase-orders/${order.id}?pay=1` }
                              : null;
                    const pay =
                      order.status === "cancelled" || order.status === "draft"
                        ? null
                        : total <= 0
                          ? { label: "No costs", tone: "none" }
                          : order.payment_status === "paid"
                          ? { label: "Paid", tone: "paid" }
                          : order.payment_status === "partial"
                            ? { label: "Partly paid", tone: "partial" }
                            : { label: "Unpaid", tone: "unpaid" };
                    const meta = [
                      shortDate(orderDate(order)),
                      order.depot_name_snapshot,
                      order.supplier_name_snapshot,
                      `${order.lines.length} ${order.lines.length === 1 ? "line" : "lines"}`,
                      order.expected_delivery_date && (order.status === "ordered" || order.status === "partially_received")
                        ? `expected ${shortDate(order.expected_delivery_date).replace(/, \d{4}$/, "")}`
                        : "",
                      missingCosts ? "no unit costs" : "",
                    ].filter(Boolean);
                    return (
                      <div
                        key={order.id}
                        className={`pol-v2-row ${order.status === "cancelled" ? "is-cancelled" : ""} ${index < 10 ? "motion-enter" : ""}`}
                        style={index < 10 ? { animationDelay: `${150 + index * 50}ms` } : undefined}
                      >
                        <Link href={`/dashboard/purchase-orders/${order.id}`} className="pol-v2-row-link" aria-label={`Open ${order.po_number}`} />
                        <span className="pol-v2-icon" aria-hidden>
                          <UiIcon name="cart" className="h-5 w-5" />
                        </span>
                        <span className="pol-v2-main">
                          <span className="pol-v2-title">
                            <b className="is-mono">{order.po_number}</b>
                            {order.title && <span>{order.title}</span>}
                          </span>
                          <small>{meta.join(" · ")}</small>
                        </span>
                        <span className="pol-v2-progress">
                          <span className="pol-v2-progress-top">
                            <span className={`pol-v2-stage is-${st.tone}`}>{st.label}</span>
                            {order.status !== "cancelled" && order.status !== "draft" && (
                              <span>
                                {progress.received} of {progress.ordered} received
                              </span>
                            )}
                          </span>
                          <span className={`pol-v2-bar is-${st.tone}`} aria-hidden>
                            <i style={{ transform: `scaleX(${progress.ordered ? progress.received / progress.ordered : 0})` }} />
                          </span>
                        </span>
                        <span className="pol-v2-pay">{pay ? <span className={`pol-v2-pill is-${pay.tone}`}>{pay.label}</span> : <span className="pol-v2-pill">—</span>}</span>
                        <span className="pol-v2-total is-mono">{formatPurchaseOrderAmount(order, total)}</span>
                        <span className="pol-v2-action">
                          {action && (
                            <Link href={action.href} className={buttonClassName({ variant: "secondary" })}>
                              {action.label}
                            </Link>
                          )}
                        </span>
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </section>
    </DashboardPageShell>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={null}>
      <PurchaseOrdersList />
    </Suspense>
  );
}
