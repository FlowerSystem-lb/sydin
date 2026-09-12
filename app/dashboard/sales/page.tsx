"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  FilterBar,
  FilterChip,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { ResultsAnnouncer, SearchInput } from "@/components/ui";
import { supabase } from "@/app/lib/supabase";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
} from "@/app/lib/businessSettings";
import { formatInventoryPrice } from "@/app/lib/inventoryItemModel";
import {
  formatSalesOrderAmount,
  getSalesOrderBalanceInBase,
  getSalesOrderTotal,
  getSalesOrderTotalInBase,
  getSalesOrdersForUser,
  isSalesSchemaMissing,
  SALES_ORDER_PAYMENT_STATUS_LABELS,
  SALES_ORDER_STATUS_LABELS,
  type SalesOrder,
  type SalesOrderStatus,
} from "@/app/lib/salesOrders";

type StatusFilter = "all" | SalesOrderStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "issued", label: "Issued" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * What the depot has sold.
 *
 * Mirrors the Purchase Orders list, because an invoice and a purchase order are
 * the same document pointed in opposite directions: a party, a date, lines, a
 * total, and how much of it has been settled.
 */
export default function SalesPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [currencyCode, setCurrencyCode] = useState(
    DEFAULT_BUSINESS_SETTINGS.currency_code
  );
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setPageError("Please sign in again to view your invoices.");
          return;
        }

        const [rows, settings] = await Promise.all([
          getSalesOrdersForUser(user.id),
          getOrCreateBusinessSettings(user.id),
        ]);

        if (!isActive) return;

        setOrders(rows);
        setCurrencyCode(
          settings?.currency_code || DEFAULT_BUSINESS_SETTINGS.currency_code
        );
      })
      .catch((error) => {
        if (!isActive) return;
        setPageError(
          isSalesSchemaMissing(error)
            ? "Invoices are not switched on for this workspace yet."
            : "We could not load your invoices. Please refresh."
        );
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const visible = useMemo(
    () => {
      const byStatus =
        statusFilter === "all"
          ? orders
          : orders.filter((order) => order.status === statusFilter);
      const needle = search.trim().toLowerCase();
      if (!needle) return byStatus;
      return byStatus.filter((order) =>
        [order.invoice_number, order.customer_name_snapshot]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    },
    [orders, statusFilter, search]
  );

  const totals = useMemo(() => {
    /* Cancelled invoices are excluded from both figures. A cancelled sale did
       not happen, and counting it would overstate what the depot has sold and
       what it is owed. */
    // A draft is not a sale yet either -- it has not been issued, nothing
    // has left stock and nobody owes anything on it.
    const live = orders.filter(
      (order) => order.status !== "cancelled" && order.status !== "draft"
    );

    // Invoices can be in different currencies; they add up in base, and
    // formatInventoryPrice shows the base sum in the display currency.
    return {
      sold: live.reduce((sum, order) => sum + getSalesOrderTotalInBase(order), 0),
      owed: live.reduce((sum, order) => sum + getSalesOrderBalanceInBase(order), 0),
    };
  }, [orders]);

  return (
    <main className="operations-workspace">
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Selling"
          title="Sales"
          description="Every invoice you have raised, what it came to, and how much of it is still owed."
          actions={
            <ActionButton icon="plus" href="/dashboard/sales/new">
              New invoice
            </ActionButton>
          }
        />

        {pageError && <DashboardNotice tone="danger">{pageError}</DashboardNotice>}

        {!loading && orders.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <MoneyFigure
              label="Sold"
              value={formatInventoryPrice(totals.sold, currencyCode) || "--"}
              note="Excludes cancelled invoices"
            />
            <MoneyFigure
              label="Still owed"
              value={formatInventoryPrice(totals.owed, currencyCode) || "--"}
              note="Total less what has been paid"
            />
          </div>
        )}

        <FilterBar label="Invoice filters" className="mt-4">
          {/* Only chips until now: with a year of invoices, finding one by
              number or customer meant scrolling. */}
          <SearchInput
            label="Search invoices"
            value={search}
            onChange={setSearch}
            placeholder="Invoice number or customer"
            className="w-full sm:max-w-xs"
          />
          {STATUS_FILTERS.map((filter) => (
            <FilterChip
              key={filter.value}
              active={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </FilterChip>
          ))}
        </FilterBar>
        <ResultsAnnouncer count={visible.length} noun="invoice" />

        {loading ? (
          <LoadingSkeletonGroup count={3} />
        ) : visible.length === 0 ? (
          <DashboardEmptyState
            icon="file"
            title={
              orders.length === 0
                ? "No invoices yet"
                : search.trim()
                  ? "No matching invoices"
                  : "No invoice with that status"
            }
            description={
              orders.length === 0
                ? "Raise one when you sell something. It records what left, who bought it, and what they owe."
                : search.trim()
                  ? "Try another invoice number or customer name."
                  : "Try a different status."
            }
            action={
              orders.length === 0 ? (
                <ActionButton icon="plus" href="/dashboard/sales/new">
                  New invoice
                </ActionButton>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-4 grid gap-2">
            {visible.map((order) => {
              const total = getSalesOrderTotal(order);

              return (
                <Link
                  key={order.id}
                  href={`/dashboard/sales/${order.id}`}
                  className="dashboard-card flex flex-col gap-2 p-4 transition hover:bg-theme-hover sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-theme-primary">
                      {order.invoice_number}
                      {order.customer_name_snapshot
                        ? ` · ${order.customer_name_snapshot}`
                        : ""}
                    </p>
                    <p className="mt-1 truncate text-xs text-theme-muted">
                      {[
                        order.issue_date || "No date",
                        `${(order.lines || []).length} line${
                          (order.lines || []).length === 1 ? "" : "s"
                        }`,
                        SALES_ORDER_PAYMENT_STATUS_LABELS[order.payment_status],
                      ].join(" · ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-theme-primary">
                      {formatSalesOrderAmount(order, total) || "--"}
                    </span>
                    <StatusPill status={order.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </DashboardPageShell>
    </main>
  );
}

function MoneyFigure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="dashboard-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-theme-muted">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold text-theme-primary tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-theme-subtle">{note}</p>
    </div>
  );
}

/**
 * The state is always written in words. A colour on its own is not a label --
 * the same rule the inventory rows and the mobile spec already follow.
 */
function StatusPill({ status }: { status: SalesOrderStatus }) {
  const tone =
    status === "paid"
      ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-700"
      : status === "cancelled"
        ? "border-red-300/30 bg-red-500/10 text-red-700"
        : status === "issued"
          ? "border-blue-300/30 bg-blue-500/10 text-blue-700"
          : "border-theme bg-theme-inset text-theme-secondary";

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {SALES_ORDER_STATUS_LABELS[status]}
    </span>
  );
}
