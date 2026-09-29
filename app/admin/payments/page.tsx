"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { adminFetch, formatAdminDate, formatUsd, planLabel } from "@/app/lib/adminClient";

/* Admin > Payments: every payment recorded, totals by month, CSV export
   (opens in Excel). */

interface PaymentRow {
  id: number;
  user_id: string;
  plan: string;
  billing_cycle: string;
  months: number;
  amount: number;
  currency: string;
  method: string | null;
  reference: string | null;
  period_start: string;
  period_end: string;
  paid_at: string;
  customer: { email: string | null; business: string | null } | null;
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function downloadCsv(rows: PaymentRow[]) {
  const header = ["Date", "Business", "Email", "Plan", "Billing", "Months", "Amount", "Currency", "Paid by", "Reference", "Period start", "Period end"];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [
    header.map(escape).join(","),
    ...rows.map((row) =>
      [
        row.paid_at.slice(0, 10),
        row.customer?.business,
        row.customer?.email,
        planLabel(row.plan),
        row.billing_cycle,
        row.months,
        row.amount.toFixed(2),
        row.currency,
        row.method,
        row.reference,
        row.period_start.slice(0, 10),
        row.period_end.slice(0, 10),
      ]
        .map(escape)
        .join(",")
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sydin-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<{ payments: PaymentRow[] }>("/api/admin/payments")
      .then((answer) => setRows(answer.payments))
      .catch((failure: Error) => setError(failure.message));
  }, []);

  const months = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();
    for (const row of rows ?? []) {
      const key = monthKey(row.paid_at);
      const entry = totals.get(key) ?? { total: 0, count: 0 };
      entry.total += row.amount;
      entry.count += 1;
      totals.set(key, entry);
    }
    return Array.from(totals.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [rows]);

  const thisMonth = months.find(([key]) => key === new Date().toISOString().slice(0, 7))?.[1].total ?? 0;
  const allTime = (rows ?? []).reduce((sum, row) => sum + row.amount, 0);
  const best = Math.max(1, ...months.map(([, entry]) => entry.total));

  return (
    <AdminShell
      title="Payments"
      subtitle="Every payment you recorded, and what came in each month."
      actions={
        <button type="button" className="ad-btn" disabled={!rows?.length} onClick={() => rows && downloadCsv(rows)}>
          Export to Excel (CSV)
        </button>
      }
    >
      {error && <p className="ad-error">{error}</p>}

      <div className="ad-stats">
        <div className="ad-stat">
          <span>This month</span>
          <strong>{rows ? formatUsd(thisMonth) : "…"}</strong>
        </div>
        <div className="ad-stat">
          <span>All time</span>
          <strong>{rows ? formatUsd(allTime) : "…"}</strong>
        </div>
        <div className="ad-stat">
          <span>Payments</span>
          <strong>{rows ? rows.length : "…"}</strong>
        </div>
      </div>

      {months.length > 0 && (
        <section className="ad-card">
          <h2>By month</h2>
          <ul className="ad-bars">
            {months.map(([key, entry]) => (
              <li key={key}>
                <span className="ad-bar-label">{monthLabel(key)}</span>
                <span className="ad-bar-track">
                  <span className="ad-bar-fill" style={{ width: `${Math.max(3, (entry.total / best) * 100)}%` }} />
                </span>
                <span className="ad-bar-value">
                  {formatUsd(entry.total)} <em>· {entry.count}</em>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Business</th>
              <th>Plan</th>
              <th>Period</th>
              <th>Paid by</th>
              <th className="ad-num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {!rows && !error && (
              <tr>
                <td colSpan={6} className="ad-empty">Loading…</td>
              </tr>
            )}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="ad-empty">No payments recorded yet.</td>
              </tr>
            )}
            {(rows ?? []).map((row) => (
              <tr key={row.id}>
                <td>{formatAdminDate(row.paid_at)}</td>
                <td>
                  <Link href={`/admin/customers/${row.user_id}`} className="ad-name">
                    {row.customer?.business || "No business name"}
                  </Link>
                  <span className="ad-sub">{row.customer?.email}</span>
                </td>
                <td>{planLabel(row.plan)} · {row.billing_cycle}</td>
                <td>{formatAdminDate(row.period_start)} – {formatAdminDate(row.period_end)}</td>
                <td>
                  {row.method || "—"}
                  {row.reference && <span className="ad-sub">#{row.reference}</span>}
                </td>
                <td className="ad-num">{formatUsd(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
