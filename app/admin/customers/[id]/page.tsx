"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import {
  CUSTOMER_STATE_LABELS,
  adminFetch,
  customerState,
  formatAdminDate,
  formatUsd,
  planLabel,
  reminderWhatsApp,
  type AdminCustomer,
} from "@/app/lib/adminClient";

/* Admin > one customer: everything about their subscription and every
   action on it, each written to the audit log. Nothing here deletes data. */

interface Detail {
  customer: AdminCustomer;
  payments: {
    id: number;
    plan: string;
    billing_cycle: string;
    months: number;
    amount: number | string;
    currency: string;
    method: string | null;
    reference: string | null;
    note: string | null;
    period_start: string;
    period_end: string;
    paid_at: string;
  }[];
  notes: { id: number; note: string; created_at: string }[];
  log: { id: number; action: string; details: Record<string, unknown>; created_at: string }[];
}

const ACTION_LABELS: Record<string, string> = {
  record_payment: "Payment recorded",
  extend: "Extended",
  change_plan: "Plan changed",
  cancel_now: "Cancelled",
  stop_renewal: "Renewal setting changed",
  reactivate: "Turned back on",
  remove_end_date: "End date removed",
  note: "Note added",
};

const PRICES: Record<string, Record<string, number>> = {
  standard: { monthly: 9, yearly: 90 },
  pro: { monthly: 19, yearly: 190 },
};

export default function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState(7);
  const [pay, setPay] = useState({ plan: "standard", cycle: "monthly", months: 1, amount: "9", method: "Whish Money", reference: "" });

  const load = useCallback(() => {
    adminFetch<Detail>(`/api/admin/customers/${id}`)
      .then((answer) => {
        setDetail(answer);
        const plan = answer.customer.plan === "pro" ? "pro" : "standard";
        const cycle = answer.customer.billing_cycle === "yearly" ? "yearly" : "monthly";
        setPay((current) => ({ ...current, plan, cycle, months: cycle === "yearly" ? 12 : 1, amount: String(PRICES[plan][cycle]) }));
      })
      .catch((failure: Error) => setError(failure.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    setFlash("");
    try {
      const answer = await adminFetch<Detail>(`/api/admin/customers/${id}`, {
        method: "POST",
        body: JSON.stringify({ action, ...extra }),
      });
      setDetail(answer);
      setFlash(`${ACTION_LABELS[action] ?? "Done"}.`);
      if (action === "note") setNote("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async () => {
    if (!detail) return;
    const planName = planLabel(pay.plan);
    if (!window.confirm(`Record ${pay.amount} USD for ${pay.months} month(s) of ${planName} (${pay.method})?\n\nThe plan turns on straight away.`)) return;
    setBusy(true);
    setError("");
    setFlash("");
    try {
      await adminFetch("/api/admin/billing", {
        method: "POST",
        body: JSON.stringify({
          email: detail.customer.email,
          plan: pay.plan,
          cycle: pay.cycle,
          months: pay.months,
          amount: Number(pay.amount),
          currency: "USD",
          method: pay.method,
          reference: pay.reference,
        }),
      });
      setPay((current) => ({ ...current, reference: "" }));
      setFlash("Payment recorded. The plan is on.");
      load();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return (
      <AdminShell title="Customer">
        {error ? <p className="ad-error">{error}</p> : <p className="ad-muted">Loading…</p>}
      </AdminShell>
    );
  }

  const c = detail.customer;
  const state = customerState(c);
  const whatsapp = reminderWhatsApp(c);
  const paidPlan = ["standard", "pro"].includes(c.plan);

  return (
    <AdminShell
      title={c.business_name || "No business name"}
      subtitle={c.email ?? undefined}
      actions={
        <Link href="/admin/customers" className="ad-btn ad-btn-ghost">
          ← All customers
        </Link>
      }
    >
      {flash && <p className="ad-flash" role="status">{flash}</p>}
      {error && <p className="ad-error" role="alert">{error}</p>}

      <div className="ad-grid">
        <section className="ad-card">
          <h2>Subscription</h2>
          <dl className="ad-facts">
            <div><dt>Plan</dt><dd>{planLabel(c.plan)}</dd></div>
            <div><dt>Status</dt><dd><span className={`ad-state ad-state-${state}`}>{CUSTOMER_STATE_LABELS[state]}</span></dd></div>
            <div><dt>Paid until</dt><dd>{c.paid_until ? formatAdminDate(c.paid_until) : "No end date"}</dd></div>
            <div><dt>Limits now</dt><dd>{planLabel(c.effective_plan)}</dd></div>
            <div><dt>Renewal</dt><dd>{c.cancel_at_period_end ? "Won't renew" : "Expected"}</dd></div>
            <div><dt>Paid in total</dt><dd>{formatUsd(c.total_paid)}</dd></div>
          </dl>

          <div className="ad-actions">
            {whatsapp ? (
              <a className="ad-btn ad-btn-green" href={whatsapp} target="_blank" rel="noopener noreferrer">
                WhatsApp reminder
              </a>
            ) : (
              <span className="ad-muted">No phone on file for a WhatsApp reminder.</span>
            )}
            {paidPlan && c.paid_until && (
              <span className="ad-inline">
                <input
                  className="ad-input ad-input-sm"
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(event) => setDays(Math.max(1, Math.min(365, Number(event.target.value) || 1)))}
                  aria-label="Days to add"
                />
                <button type="button" className="ad-btn" disabled={busy} onClick={() => void act("extend", { days }, `Give ${days} free day(s)?`)}>
                  Add free days
                </button>
              </span>
            )}
            {paidPlan && c.paid_until && (
              <button type="button" className="ad-btn" disabled={busy} onClick={() => void act("remove_end_date", {}, "Remove the end date? The plan then never expires until you change it.")}>
                Remove end date
              </button>
            )}
            {paidPlan && c.status === "active" && (
              <button type="button" className="ad-btn" disabled={busy} onClick={() => void act("stop_renewal", { on: !c.cancel_at_period_end })}>
                {c.cancel_at_period_end ? "Expect renewal again" : "Won't renew"}
              </button>
            )}
            {c.status === "cancelled" ? (
              <button type="button" className="ad-btn" disabled={busy} onClick={() => void act("reactivate")}>
                Turn plan back on
              </button>
            ) : (
              paidPlan && (
                <button
                  type="button"
                  className="ad-btn ad-btn-danger"
                  disabled={busy}
                  onClick={() => void act("cancel_now", {}, "Cancel now? They drop to Free limits immediately. No data is deleted.")}
                >
                  Cancel plan now
                </button>
              )
            )}
          </div>

          <div className="ad-inline ad-mt">
            <span className="ad-muted">Change plan:</span>
            {(["free", "standard", "pro"] as const).map((plan) => (
              <button
                key={plan}
                type="button"
                className={`ad-chip${c.plan === plan ? " ad-chip-on" : ""}`}
                disabled={busy || c.plan === plan}
                onClick={() => void act("change_plan", { plan }, `Switch to ${planLabel(plan)}? (Keeps the current end date.)`)}
              >
                {planLabel(plan)}
              </button>
            ))}
          </div>
        </section>

        <section className="ad-card">
          <h2>Record a payment</h2>
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
          <button type="button" className="ad-btn ad-btn-primary ad-mt" disabled={busy} onClick={() => void recordPayment()}>
            Record payment and turn the plan on
          </button>
        </section>
      </div>

      <div className="ad-grid">
        <section className="ad-card">
          <h2>Account</h2>
          <dl className="ad-facts">
            <div><dt>Phone</dt><dd>{c.phone || "—"}</dd></div>
            <div><dt>Joined</dt><dd>{formatAdminDate(c.signed_up)}</dd></div>
            <div><dt>Last sign-in</dt><dd>{formatAdminDate(c.last_sign_in)}</dd></div>
            <div><dt>Items</dt><dd>{c.items}</dd></div>
            <div><dt>Team members</dt><dd>{c.members}</dd></div>
          </dl>
        </section>

        <section className="ad-card">
          <h2>Private notes</h2>
          <div className="ad-inline">
            <input className="ad-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Only you see this" maxLength={2000} />
            <button type="button" className="ad-btn" disabled={busy || !note.trim()} onClick={() => void act("note", { note })}>
              Add
            </button>
          </div>
          <ul className="ad-list">
            {detail.notes.length === 0 && <li className="ad-muted">No notes yet.</li>}
            {detail.notes.map((entry) => (
              <li key={entry.id}>
                <span className="ad-sub">{formatAdminDate(entry.created_at)}</span>
                {entry.note}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="ad-card">
        <h2>Payments</h2>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Period</th>
                <th>Paid by</th>
                <th className="ad-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {detail.payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="ad-empty">No payments yet.</td>
                </tr>
              )}
              {detail.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatAdminDate(payment.paid_at)}</td>
                  <td>{planLabel(payment.plan)} · {payment.billing_cycle}</td>
                  <td>{formatAdminDate(payment.period_start)} – {formatAdminDate(payment.period_end)}</td>
                  <td>
                    {payment.method || "—"}
                    {payment.reference && <span className="ad-sub">#{payment.reference}</span>}
                  </td>
                  <td className="ad-num">{formatUsd(Number(payment.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ad-card">
        <h2>History</h2>
        <ul className="ad-list">
          {detail.log.length === 0 && <li className="ad-muted">Nothing done on this account from admin yet.</li>}
          {detail.log.map((entry) => (
            <li key={entry.id}>
              <span className="ad-sub">{new Date(entry.created_at).toLocaleString()}</span>
              {ACTION_LABELS[entry.action] ?? entry.action}
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
