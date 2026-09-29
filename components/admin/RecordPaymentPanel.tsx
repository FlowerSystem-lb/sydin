"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";

/* /admin > Record a payment (phase 32).
 *
 * The WhatsApp moment: a customer says "I paid". Look them up by email, pick
 * the plan and period, record it -- the database moves their paid-until date
 * forward and their plan is on straight away. Paying inside the 3-day grace
 * continues from the old end date, so late payers never gain free days. */

type Plan = "standard" | "pro";
type Cycle = "monthly" | "yearly";

interface Summary {
  user: { id: string; email: string | null };
  businessName: string | null;
  subscription: {
    plan: string | null;
    status: string | null;
    paid_until: string | null;
    billing_cycle: string | null;
  } | null;
  payments: {
    id: number;
    plan: string;
    months: number;
    amount: number;
    currency: string;
    method: string | null;
    reference: string | null;
    period_start: string;
    period_end: string;
    paid_at: string;
  }[];
}

const PRICES: Record<Plan, Record<Cycle, number>> = {
  standard: { monthly: 9, yearly: 90 },
  pro: { monthly: 19, yearly: 190 },
};

const METHODS = ["Whish Money", "OMT", "Crypto", "Cash", "Bank transfer"];

function formatDate(value: string | null | undefined) {
  if (!value) return "No end date";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function stateOf(summary: Summary) {
  const sub = summary.subscription;
  if (!sub || String(sub.status).toLowerCase() !== "active" || !["standard", "pro"].includes(String(sub.plan))) {
    return { label: "Free", tone: "text-slate-300" };
  }
  if (!sub.paid_until) return { label: `${sub.plan} · no end date`, tone: "text-emerald-300" };
  const end = Date.parse(sub.paid_until);
  const now = Date.now();
  if (now > end + 3 * 86400000) return { label: `${sub.plan} · expired (Free limits)`, tone: "text-rose-300" };
  if (now > end) return { label: `${sub.plan} · in 3-day grace`, tone: "text-amber-300" };
  return { label: `${sub.plan} · paid`, tone: "text-emerald-300" };
}

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

export default function RecordPaymentPanel() {
  const [email, setEmail] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [plan, setPlan] = useState<Plan>("standard");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(String(PRICES.standard.monthly));
  const [method, setMethod] = useState(METHODS[0]);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const setPlanAndPrice = (nextPlan: Plan, nextCycle: Cycle) => {
    setPlan(nextPlan);
    setCycle(nextCycle);
    setMonths(nextCycle === "yearly" ? 12 : 1);
    setAmount(String(PRICES[nextPlan][nextCycle]));
  };

  const lookUp = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/admin/billing?email=${encodeURIComponent(email.trim())}`, {
      headers: await authHeader(),
    }).catch(() => null);
    const answer = response ? await response.json().catch(() => ({})) : {};
    setBusy(false);
    if (!response || !response.ok) {
      setSummary(null);
      setMessage({ tone: "error", text: (answer as { error?: string }).error || "Lookup failed." });
      return;
    }
    const found = answer as Summary;
    setSummary(found);
    const current = found.subscription?.plan === "pro" ? "pro" : "standard";
    setPlanAndPrice(current, found.subscription?.billing_cycle === "yearly" ? "yearly" : "monthly");
  };

  const record = async () => {
    if (!summary) return;
    const ok = window.confirm(
      `Record ${amount} USD from ${summary.user.email} for ${months} month${months === 1 ? "" : "s"} of ${plan === "pro" ? "Pro" : "Standard"} (${method})?\n\nTheir plan turns on straight away.`
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({
        email: summary.user.email,
        plan,
        cycle,
        months,
        amount: Number(amount),
        currency: "USD",
        method,
        reference,
        note,
      }),
    }).catch(() => null);
    const answer = response ? await response.json().catch(() => ({})) : {};
    setBusy(false);
    if (!response || !response.ok) {
      setMessage({ tone: "error", text: (answer as { error?: string }).error || "Could not record it." });
      return;
    }
    const updated = answer as Summary;
    setSummary(updated);
    setReference("");
    setNote("");
    setMessage({
      tone: "ok",
      text: `Recorded. ${updated.businessName || updated.user.email} is on ${plan === "pro" ? "Pro" : "Standard"} until ${formatDate(updated.subscription?.paid_until)}.`,
    });
  };

  const state = summary ? stateOf(summary) : null;

  return (
    <section className="glass-panel p-5 sm:p-7" aria-labelledby="record-payment-title">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Customer paid?</p>
      <h2 id="record-payment-title" className="mt-1 text-2xl font-black tracking-tight">
        Record a payment
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        When a customer sends you their Whish / OMT receipt, find them here and record it. Their plan turns on at
        once and the payment shows in their Plan &amp; billing history. Paying late continues from their old end
        date; after 3 unpaid days an account falls back to Free limits, with all its data kept.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          className="glass-input min-h-12 flex-1"
          type="email"
          placeholder="Customer's sign-in email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void lookUp();
          }}
        />
        <button type="button" className="glass-button min-h-12 rounded-2xl px-5 text-sm" onClick={() => void lookUp()} disabled={busy}>
          {busy && !summary ? "Looking up..." : "Find account"}
        </button>
      </div>

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            message.tone === "error" ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-200"
          }`}
        >
          {message.text}
        </p>
      )}

      {summary && state && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="glass-card p-4 sm:p-5">
            <p className="text-sm text-slate-400">{summary.user.email}</p>
            <p className="mt-1 text-xl font-black">{summary.businessName || "No business name"}</p>
            <p className={`mt-2 text-sm font-bold capitalize ${state.tone}`}>{state.label}</p>
            <p className="mt-1 text-sm text-slate-400">Paid until: {formatDate(summary.subscription?.paid_until)}</p>

            <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Recent payments</p>
            {summary.payments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">None recorded yet.</p>
            ) : (
              <ul className="mt-2 grid gap-2 text-sm">
                {summary.payments.slice(0, 6).map((payment) => (
                  <li key={payment.id} className="flex justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                    <span>
                      {formatDate(payment.paid_at)} · <span className="capitalize">{payment.plan}</span> ·{" "}
                      {payment.months} mo{payment.method ? ` · ${payment.method}` : ""}
                    </span>
                    <strong>
                      {Number(payment.amount).toFixed(2)} {payment.currency}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-card grid gap-3 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Plan
                <select className="glass-input min-h-11" value={plan} onChange={(event) => setPlanAndPrice(event.target.value as Plan, cycle)}>
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Period
                <select className="glass-input min-h-11" value={cycle} onChange={(event) => setPlanAndPrice(plan, event.target.value as Cycle)}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Months
                <input
                  className="glass-input min-h-11"
                  type="number"
                  min={1}
                  max={24}
                  value={months}
                  onChange={(event) => setMonths(Math.min(24, Math.max(1, Number(event.target.value) || 1)))}
                />
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Amount (USD)
                <input className="glass-input min-h-11" type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Paid by
                <select className="glass-input min-h-11" value={method} onChange={(event) => setMethod(event.target.value)}>
                  {METHODS.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-400">
                Receipt / reference
                <input className="glass-input min-h-11" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional" />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-bold text-slate-400">
              Note (only you see it)
              <input className="glass-input min-h-11" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
            </label>
            <button
              type="button"
              className="glass-button min-h-12 rounded-2xl px-5 text-sm"
              onClick={() => void record()}
              disabled={busy || !(Number(amount) >= 0)}
            >
              {busy ? "Saving..." : "Record payment and turn the plan on"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
