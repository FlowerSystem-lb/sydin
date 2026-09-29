"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { adminFetch } from "@/app/lib/adminClient";

/* Admin > Activity: the audit log -- every admin action, newest first. */

interface LogRow {
  id: number;
  action: string;
  target_user: string | null;
  details: Record<string, unknown>;
  created_at: string;
  admin: string | null;
  customer: { email: string | null; business: string | null } | null;
}

const LABELS: Record<string, string> = {
  record_payment: "Recorded a payment",
  extend: "Added free days",
  change_plan: "Changed the plan",
  cancel_now: "Cancelled the plan",
  stop_renewal: "Changed renewal",
  reactivate: "Turned the plan back on",
  remove_end_date: "Removed the end date",
  note: "Added a note",
  email_renew_7d: "Emailed: renews in 7 days",
  email_grace_start: "Emailed: 3 days to pay",
  email_ended: "Emailed: moved to Free",
  email_test: "Sent a test email",
  email_run: "Ran the daily email check",
  request_mark_paid: "Marked a request paid",
  request_reject: "Rejected a request",
  request_reopen: "Reopened a request",
  request_mark_activated: "Started a plan from a request",
  request_edit: "Edited a request",
  request_delete: "Deleted a request",
};

function describe(row: LogRow) {
  const d = row.details || {};
  if (row.action === "record_payment") return `${d.months ?? "?"} mo ${String(d.plan ?? "")} · ${d.amount ?? "?"} ${d.currency ?? ""}${d.method ? ` · ${d.method}` : ""}`;
  if (row.action === "extend") return `+${d.days ?? "?"} days`;
  if (row.action === "change_plan") return `${d.from ?? "?"} → ${d.to ?? "?"}`;
  if (row.action === "stop_renewal") return d.on ? "Won't renew" : "Renewal expected";
  return "";
}

export default function AdminActivityPage() {
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<{ log: LogRow[] }>("/api/admin/payments")
      .then((answer) => setRows(answer.log))
      .catch((failure: Error) => setError(failure.message));
  }, []);

  return (
    <AdminShell title="Activity" subtitle="Every action taken in admin: who, what, on which account, and when.">
      {error && <p className="ad-error">{error}</p>}
      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th>Account</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {!rows && !error && (
              <tr>
                <td colSpan={4} className="ad-empty">Loading…</td>
              </tr>
            )}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="ad-empty">No admin actions yet.</td>
              </tr>
            )}
            {(rows ?? []).map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td>
                  {LABELS[row.action] ?? row.action}
                  {describe(row) && <span className="ad-sub">{describe(row)}</span>}
                </td>
                <td>
                  {row.target_user ? (
                    <Link href={`/admin/customers/${row.target_user}`} className="ad-name">
                      {row.customer?.business || row.customer?.email || "Account"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{row.admin ?? (row.action.startsWith("email_") ? "SydIN (automatic)" : "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
