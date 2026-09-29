"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import {
  CUSTOMER_STATE_LABELS,
  adminFetch,
  customerState,
  formatAdminDate,
  formatUsd,
  planLabel,
  type AdminCustomer,
  type CustomerState,
} from "@/app/lib/adminClient";

/* Admin > Customers (30 Sep 2026): every SydIN business in one list --
   plan, where they are in the payment cycle, and who to chase first. */

type Filter = "all" | "paying" | "attention" | "free" | "team";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paying", label: "Paying" },
  { id: "attention", label: "Needs attention" },
  { id: "free", label: "Free" },
  { id: "team", label: "Team logins" },
];

const ATTENTION: CustomerState[] = ["due_soon", "grace", "ended"];

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<AdminCustomer[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    adminFetch<{ customers: AdminCustomer[] }>("/api/admin/customers")
      .then((answer) => setRows(answer.customers))
      .catch((failure: Error) => setError(failure.message));
  }, []);

  const enriched = useMemo(
    () => (rows ?? []).map((row) => ({ ...row, state: customerState(row) })),
    [rows]
  );

  const owners = enriched.filter((row) => !row.is_team_member);
  const stats = {
    businesses: owners.length,
    paying: owners.filter((row) => ["paid", "no_end", "due_soon", "grace"].includes(row.state)).length,
    attention: owners.filter((row) => ATTENTION.includes(row.state)).length,
    revenue: owners.reduce((sum, row) => sum + row.total_paid, 0),
  };

  const visible = enriched.filter((row) => {
    if (filter === "team" ? !row.is_team_member : row.is_team_member) return false;
    if (filter === "paying" && !["paid", "no_end", "due_soon", "grace"].includes(row.state)) return false;
    if (filter === "attention" && !ATTENTION.includes(row.state)) return false;
    if (filter === "free" && !["free", "cancelled"].includes(row.state)) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [row.email, row.business_name, row.phone].some((value) => String(value || "").toLowerCase().includes(needle));
  });

  return (
    <AdminShell title="Customers" subtitle="Every SydIN business, where it is in the payment cycle, and who to follow up.">
      <div className="ad-stats">
        <div className="ad-stat">
          <span>Businesses</span>
          <strong>{rows ? stats.businesses : "…"}</strong>
        </div>
        <div className="ad-stat">
          <span>Paying</span>
          <strong>{rows ? stats.paying : "…"}</strong>
        </div>
        <div className={`ad-stat${stats.attention ? " ad-stat-warn" : ""}`}>
          <span>Need attention</span>
          <strong>{rows ? stats.attention : "…"}</strong>
        </div>
        <div className="ad-stat">
          <span>Collected (all time)</span>
          <strong>{rows ? formatUsd(stats.revenue) : "…"}</strong>
        </div>
      </div>

      <div className="ad-toolbar">
        <input
          className="ad-input ad-search"
          placeholder="Search name, email or phone"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search customers"
        />
        <div className="ad-chips" role="tablist" aria-label="Filter">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={filter === entry.id}
              className={`ad-chip${filter === entry.id ? " ad-chip-on" : ""}`}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="ad-error">{error}</p>}

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Paid until</th>
              <th>Last payment</th>
              <th className="ad-num">Items</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {!rows && !error && (
              <tr>
                <td colSpan={7} className="ad-empty">
                  Loading customers…
                </td>
              </tr>
            )}
            {rows && visible.length === 0 && (
              <tr>
                <td colSpan={7} className="ad-empty">
                  Nobody matches.
                </td>
              </tr>
            )}
            {visible.map((row) => (
              <tr key={row.user_id}>
                <td>
                  <Link href={`/admin/customers/${row.user_id}`} className="ad-name">
                    {row.business_name || "No business name"}
                  </Link>
                  <span className="ad-sub">{row.email}</span>
                </td>
                <td>{planLabel(row.plan)}</td>
                <td>
                  <span className={`ad-state ad-state-${row.state}`}>{CUSTOMER_STATE_LABELS[row.state]}</span>
                  {row.cancel_at_period_end && <span className="ad-sub">Won&apos;t renew</span>}
                </td>
                <td>{row.paid_until ? formatAdminDate(row.paid_until) : "—"}</td>
                <td>
                  {row.last_paid_at ? formatAdminDate(row.last_paid_at) : "—"}
                  {row.total_paid > 0 && <span className="ad-sub">{formatUsd(row.total_paid)} total</span>}
                </td>
                <td className="ad-num">{row.items}</td>
                <td>{formatAdminDate(row.signed_up)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
