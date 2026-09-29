"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { adminFetch, formatAdminDate } from "@/app/lib/adminClient";

/* Admin > Plan requests (rebuilt 30 Sep 2026 inside the admin console --
   was a separate dark page). Everything a request needs, on its card:
   contact on WhatsApp, mark paid, approve & start the plan (records the
   payment with a real paid period), reject / reopen, edit, delete. */

type Status = "pending" | "paid" | "activated" | "rejected";

interface PlanRequest {
  id: string;
  full_name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  selected_plan: string;
  message: string | null;
  created_at: string | null;
  status: Status;
  user_id: string | null;
  paid_at: string | null;
  activated_at: string | null;
  admin_notes: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "New",
  paid: "Paid · to start",
  activated: "Started",
  rejected: "Rejected",
};

const STATE_CLASS: Record<Status, string> = {
  pending: "ad-state-due_soon",
  paid: "ad-state-grace",
  activated: "ad-state-paid",
  rejected: "ad-state-cancelled",
};

const PRICES: Record<string, Record<string, number>> = {
  standard: { monthly: 9, yearly: 90 },
  pro: { monthly: 19, yearly: 190 },
};

type Filter = "open" | Status | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "open", label: "To handle" },
  { id: "pending", label: "New" },
  { id: "paid", label: "Paid" },
  { id: "activated", label: "Started" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

function whatsappLink(phone: string | null, name: string, plan: string) {
  const digits = String(phone || "").replace(/[^\d]/g, "").replace(/^00/, "");
  if (!digits) return null;
  const number = digits.startsWith("961") || digits.length > 9 ? digits : `961${digits.replace(/^0/, "")}`;
  const message = `Hello ${name}, this is SydIN about your ${plan} plan request.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export default function AdminPlanRequestsPage() {
  const [rows, setRows] = useState<PlanRequest[] | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ selected_plan: "Standard", phone: "", business_name: "", admin_notes: "" });
  const [pay, setPay] = useState({ plan: "standard", cycle: "monthly", months: 1, amount: "9", method: "Whish Money", reference: "" });

  const load = useCallback(() => {
    adminFetch<{ requests: PlanRequest[] }>("/api/admin/plan-requests")
      .then((answer) => setRows(answer.requests))
      .catch((failure: Error) => setError(failure.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const all = rows ?? [];
    return {
      pending: all.filter((row) => row.status === "pending").length,
      paid: all.filter((row) => row.status === "paid").length,
      activated: all.filter((row) => row.status === "activated").length,
      rejected: all.filter((row) => row.status === "rejected").length,
    };
  }, [rows]);

  const visible = (rows ?? []).filter((row) => {
    if (filter === "open" && !["pending", "paid"].includes(row.status)) return false;
    if (filter !== "open" && filter !== "all" && row.status !== filter) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [row.full_name, row.business_name, row.email, row.phone].some((value) => String(value || "").toLowerCase().includes(needle));
  });

  const run = async (id: string, work: () => Promise<unknown>, done: string) => {
    setBusyId(id);
    setError("");
    setFlash("");
    try {
      await work();
      setFlash(done);
      load();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const patch = (id: string, body: Record<string, unknown>) =>
    adminFetch(`/api/admin/plan-requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });

  const startApprove = (row: PlanRequest) => {
    const plan = row.selected_plan.toLowerCase() === "pro" ? "pro" : "standard";
    setPay({ plan, cycle: "monthly", months: 1, amount: String(PRICES[plan].monthly), method: "Whish Money", reference: "" });
    setEditing(null);
    setApproving(row.id);
  };

  const approve = (row: PlanRequest) =>
    run(
      row.id,
      async () => {
        const answer = await adminFetch<{ user: { id: string } }>("/api/admin/billing", {
          method: "POST",
          body: JSON.stringify({
            email: row.email,
            plan: pay.plan,
            cycle: pay.cycle,
            months: pay.months,
            amount: Number(pay.amount),
            currency: "USD",
            method: pay.method,
            reference: pay.reference,
            note: `From plan request #${row.id}`,
          }),
        });
        await patch(row.id, { action: "mark_activated", user_id: answer.user.id });
        setApproving(null);
      },
      `${row.business_name || row.full_name} is on ${pay.plan === "pro" ? "Pro" : "Standard"}. Payment recorded.`
    );

  const startEdit = (row: PlanRequest) => {
    setDraft({
      selected_plan: row.selected_plan.toLowerCase() === "pro" ? "Pro" : "Standard",
      phone: row.phone ?? "",
      business_name: row.business_name ?? "",
      admin_notes: row.admin_notes ?? "",
    });
    setApproving(null);
    setEditing(row.id);
  };

  return (
    <AdminShell title="Plan requests" subtitle="People who asked for Standard or Pro. Contact them, confirm the payment, and start their plan.">
      <div className="ad-stats">
        <div className={`ad-stat${counts.pending ? " ad-stat-warn" : ""}`}>
          <span>New</span>
          <strong>{rows ? counts.pending : "…"}</strong>
        </div>
        <div className="ad-stat">
          <span>Paid · to start</span>
          <strong>{rows ? counts.paid : "…"}</strong>
        </div>
        <div className="ad-stat">
          <span>Started</span>
          <strong>{rows ? counts.activated : "…"}</strong>
        </div>
        <div className="ad-stat">
          <span>Rejected</span>
          <strong>{rows ? counts.rejected : "…"}</strong>
        </div>
      </div>

      <div className="ad-toolbar">
        <input
          className="ad-input ad-search"
          placeholder="Search name, business, email or phone"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search requests"
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

      {flash && <p className="ad-flash" role="status">{flash}</p>}
      {error && <p className="ad-error" role="alert">{error}</p>}

      {!rows && !error && <p className="ad-muted">Loading requests…</p>}
      {rows && visible.length === 0 && (
        <div className="ad-card">
          <p className="ad-muted">{filter === "open" ? "Nothing to handle. New requests show up here." : "No requests match."}</p>
        </div>
      )}

      <div className="ad-requests">
        {visible.map((row) => {
          const busy = busyId === row.id;
          const whatsapp = whatsappLink(row.phone, row.full_name, row.selected_plan);
          return (
            <article key={row.id} className="ad-card ad-request">
              <div className="ad-request-head">
                <div className="min-w-0">
                  <p className="ad-request-name">
                    {row.full_name}
                    {row.business_name && <span> · {row.business_name}</span>}
                  </p>
                  <p className="ad-sub">
                    Asked for <strong>{row.selected_plan}</strong> on {formatAdminDate(row.created_at)}
                    {row.paid_at && ` · paid ${formatAdminDate(row.paid_at)}`}
                    {row.activated_at && ` · started ${formatAdminDate(row.activated_at)}`}
                  </p>
                </div>
                <span className={`ad-state ${STATE_CLASS[row.status]}`}>{STATUS_LABEL[row.status]}</span>
              </div>

              <dl className="ad-facts">
                <div><dt>Email</dt><dd>{row.email || "—"}</dd></div>
                <div><dt>Phone</dt><dd>{row.phone || "—"}</dd></div>
              </dl>
              {row.message && <p className="ad-request-msg">“{row.message}”</p>}
              {row.admin_notes && editing !== row.id && <p className="ad-request-note">Note: {row.admin_notes}</p>}

              {approving === row.id && (
                <div className="ad-request-panel">
                  <p className="ad-request-panel-title">Approve and start the plan</p>
                  <div className="ad-form">
                    <label>
                      Plan
                      <select className="ad-input" value={pay.plan} onChange={(event) => setPay({ ...pay, plan: event.target.value, amount: String(PRICES[event.target.value][pay.cycle]) })}>
                        <option value="standard">Standard</option>
                        <option value="pro">Pro</option>
                      </select>
                    </label>
                    <label>
                      Period
                      <select
                        className="ad-input"
                        value={pay.cycle}
                        onChange={(event) =>
                          setPay({ ...pay, cycle: event.target.value, months: event.target.value === "yearly" ? 12 : 1, amount: String(PRICES[pay.plan][event.target.value]) })
                        }
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </label>
                    <label>
                      Months
                      <input className="ad-input" type="number" min={1} max={24} value={pay.months} onChange={(event) => setPay({ ...pay, months: Math.max(1, Math.min(24, Number(event.target.value) || 1)) })} />
                    </label>
                    <label>
                      Amount (USD)
                      <input className="ad-input" type="number" min={0} step="0.01" value={pay.amount} onChange={(event) => setPay({ ...pay, amount: event.target.value })} />
                    </label>
                    <label>
                      Paid by
                      <select className="ad-input" value={pay.method} onChange={(event) => setPay({ ...pay, method: event.target.value })}>
                        {["Whish Money", "OMT", "Crypto", "Cash", "Bank transfer"].map((method) => (
                          <option key={method}>{method}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Receipt / reference
                      <input className="ad-input" value={pay.reference} onChange={(event) => setPay({ ...pay, reference: event.target.value })} placeholder="Optional" />
                    </label>
                  </div>
                  <p className="ad-sub">They need a SydIN account with {row.email}. The plan starts today for the months paid.</p>
                  <div className="ad-actions">
                    <button type="button" className="ad-btn ad-btn-primary" disabled={busy} onClick={() => void approve(row)}>
                      {busy ? "Starting…" : "Record payment and start plan"}
                    </button>
                    <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setApproving(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {editing === row.id && (
                <div className="ad-request-panel">
                  <p className="ad-request-panel-title">Edit request</p>
                  <div className="ad-form">
                    <label>
                      Plan
                      <select className="ad-input" value={draft.selected_plan} onChange={(event) => setDraft({ ...draft, selected_plan: event.target.value })}>
                        <option>Standard</option>
                        <option>Pro</option>
                      </select>
                    </label>
                    <label>
                      Phone
                      <input className="ad-input" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
                    </label>
                    <label>
                      Business name
                      <input className="ad-input" value={draft.business_name} onChange={(event) => setDraft({ ...draft, business_name: event.target.value })} />
                    </label>
                    <label>
                      Private note
                      <input className="ad-input" value={draft.admin_notes} onChange={(event) => setDraft({ ...draft, admin_notes: event.target.value })} placeholder="Only you see this" />
                    </label>
                  </div>
                  <div className="ad-actions">
                    <button
                      type="button"
                      className="ad-btn ad-btn-primary"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          row.id,
                          async () => {
                            await patch(row.id, { action: "edit", ...draft });
                            setEditing(null);
                          },
                          "Request saved."
                        )
                      }
                    >
                      Save
                    </button>
                    <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="ad-actions">
                {whatsapp && (
                  <a className="ad-btn ad-btn-green" href={whatsapp} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                )}
                {row.status === "pending" && (
                  <button type="button" className="ad-btn" disabled={busy} onClick={() => void run(row.id, () => patch(row.id, { action: "mark_paid" }), "Marked paid.")}>
                    Mark paid
                  </button>
                )}
                {(row.status === "pending" || row.status === "paid") && approving !== row.id && (
                  <button type="button" className="ad-btn ad-btn-primary" disabled={busy} onClick={() => startApprove(row)}>
                    Approve &amp; start plan
                  </button>
                )}
                {row.status === "activated" && row.user_id && (
                  <Link className="ad-btn" href={`/admin/customers/${row.user_id}`}>
                    Open customer
                  </Link>
                )}
                {row.status === "rejected" && (
                  <button type="button" className="ad-btn" disabled={busy} onClick={() => void run(row.id, () => patch(row.id, { action: "reopen" }), "Reopened.")}>
                    Reopen
                  </button>
                )}
                {editing !== row.id && (
                  <button type="button" className="ad-btn" disabled={busy} onClick={() => startEdit(row)}>
                    Edit
                  </button>
                )}
                {(row.status === "pending" || row.status === "paid") && (
                  <button
                    type="button"
                    className="ad-btn ad-btn-danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Reject ${row.full_name}'s request?`)) void run(row.id, () => patch(row.id, { action: "reject" }), "Rejected.");
                    }}
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  className="ad-btn ad-btn-danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete ${row.full_name}'s request for good? Their account and plan are not touched.`))
                      void run(
                        row.id,
                        () => adminFetch(`/api/admin/plan-requests/${encodeURIComponent(row.id)}`, { method: "DELETE" }),
                        "Request deleted."
                      );
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </AdminShell>
  );
}
