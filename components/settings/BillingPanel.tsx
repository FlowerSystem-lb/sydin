"use client";

import { useState } from "react";
import { Button, DialogShell, useToast } from "@/components/ui";
import UiIcon from "@/components/UiIcon";
import UpgradeIllustration from "@/components/UpgradeIllustration";
import {
  BILLING_GRACE_DAYS,
  PLAN_DEFINITIONS,
  formatPlanName,
  getGraceEnd,
  type SubscriptionPayment,
  type UserSubscription,
} from "@/app/lib/subscription";
import {
  SYDIN_OMT_NUMBER,
  SYDIN_PAYMENT_RECEIVER,
  SYDIN_USDT_ADDRESS,
  SYDIN_USDT_NETWORK,
  SYDIN_WHATSAPP_DISPLAY,
  SYDIN_WHISH_NUMBER,
  buildPaymentWhatsAppUrl,
} from "@/app/lib/support";

/* Settings > Plan & billing (29 Sep, Sayed, after Sortly's Plan & Billing).
 *
 * Everything about paying happens on this page -- no jumping to /pricing or
 * /request-plan: the current plan and until when it is paid, usage, the three
 * plans side by side, how to pay (Whish / OMT / USDT, then send the receipt on
 * WhatsApp), and the history of every payment Sayed recorded.
 *
 * Manual payments (sql/phase-32-billing.sql): when the paid period ends there
 * are 3 days of grace with full access; after that the account uses Free
 * limits. Nothing is ever deleted -- paying again restores the plan at once. */

type UsageRow = { label: string; used: number | null; limit: number | null };
type PaidPlan = "standard" | "pro";
type Cycle = "monthly" | "yearly";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.ceil((Date.parse(value) - Date.now()) / 86400000);
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function BillingPanel({
  subscription,
  usage,
  included,
  payments,
  businessName,
  email,
}: {
  subscription: UserSubscription;
  usage: UsageRow[];
  included: [string, boolean][];
  payments: SubscriptionPayment[] | null;
  businessName: string;
  email: string;
}) {
  const { showToast } = useToast();
  const [cycle, setCycle] = useState<Cycle>(subscription.billing_cycle === "yearly" ? "yearly" : "monthly");
  const [payFor, setPayFor] = useState<PaidPlan | null>(null);

  const state = subscription.billing_state ?? (subscription.plan === "free" ? "free" : "active");
  // The plan they pay for -- shown even when it has lapsed to Free limits.
  const shownPlan = state === "expired" ? subscription.paid_plan ?? "free" : subscription.plan;
  const planDefinition = PLAN_DEFINITIONS[shownPlan] ?? PLAN_DEFINITIONS.free;
  const graceEnd = getGraceEnd(subscription.paid_until);
  const left = daysUntil(subscription.paid_until);
  const renewPlan: PaidPlan = shownPlan === "pro" ? "pro" : "standard";
  const full = usage.filter((row) => row.used !== null && row.limit !== null && row.limit > 0 && row.used >= row.limit);

  const statusPill = {
    active: { text: "Active", tone: "st-pill-green" },
    due_soon: { text: "Due soon", tone: "st-pill-amber" },
    grace: { text: "Payment due", tone: "st-pill-amber" },
    expired: { text: "Ended", tone: "st-pill-red" },
    free: { text: "Free", tone: "st-pill-grey" },
  }[state];

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ tone: "success", message: `${label} copied.` });
    } catch {
      showToast({ tone: "danger", message: "Couldn't copy. Select it and copy by hand." });
    }
  };

  const whatsappFor = (plan: PaidPlan) =>
    buildPaymentWhatsAppUrl({
      businessName,
      planName: formatPlanName(plan),
      cycle,
      email,
    });

  const payWays = [
    {
      key: "whish",
      name: "Whish Money",
      detail: `+${SYDIN_WHISH_NUMBER}`,
      sub: `Receiver: ${SYDIN_PAYMENT_RECEIVER}`,
      copyText: SYDIN_WHISH_NUMBER,
      mark: "W",
    },
    {
      key: "omt",
      name: "OMT",
      detail: `+${SYDIN_OMT_NUMBER}`,
      sub: `Receiver: ${SYDIN_PAYMENT_RECEIVER}`,
      copyText: `Receiver name: ${SYDIN_PAYMENT_RECEIVER}\nPhone number: ${SYDIN_OMT_NUMBER}`,
      mark: "O",
    },
    {
      key: "usdt",
      name: SYDIN_USDT_NETWORK,
      detail: `${SYDIN_USDT_ADDRESS.slice(0, 8)}…${SYDIN_USDT_ADDRESS.slice(-6)}`,
      sub: "Send only USDT on TRC20",
      copyText: SYDIN_USDT_ADDRESS,
      mark: "₮",
    },
  ];

  return (
    <div className="st-billing">
      {/* ---- what needs doing, if anything ---- */}
      {state === "due_soon" && (
        <div className="bl-notice bl-notice-amber" role="status">
          <UiIcon name="clock" className="h-5 w-5 shrink-0" />
          <div>
            <p className="bl-notice-title">
              Your {formatPlanName(renewPlan)} plan renews in {left} day{left === 1 ? "" : "s"}
            </p>
            <p>Pay by {formatDate(subscription.paid_until)} to keep going without a break.</p>
          </div>
          <Button size="sm" onClick={() => setPayFor(renewPlan)}>
            Pay now
          </Button>
        </div>
      )}
      {state === "grace" && (
        <div className="bl-notice bl-notice-amber" role="alert">
          <UiIcon name="alert" className="h-5 w-5 shrink-0" />
          <div>
            <p className="bl-notice-title">Your plan ended on {formatDate(subscription.paid_until)}</p>
            <p>
              You still have full access until <strong>{formatDate(graceEnd)}</strong>. Pay before then to keep{" "}
              {formatPlanName(renewPlan)}.
            </p>
          </div>
          <Button size="sm" onClick={() => setPayFor(renewPlan)}>
            Pay now
          </Button>
        </div>
      )}
      {state === "expired" && (
        <div className="bl-notice bl-notice-red" role="alert">
          <UiIcon name="shield" className="h-5 w-5 shrink-0" />
          <div>
            <p className="bl-notice-title">Your {formatPlanName(renewPlan)} plan has ended</p>
            <p>
              You&apos;re on Free limits for now. <strong>All your data is safe</strong>: every item, invoice and
              customer is still here. Pay to get {formatPlanName(renewPlan)} back instantly.
            </p>
          </div>
          <Button size="sm" onClick={() => setPayFor(renewPlan)}>
            Renew
          </Button>
        </div>
      )}

      {/* ---- plan + usage ---- */}
      <div className="st-billing-top">
        <section className="st-billing-plan" aria-label="Current plan">
          <p className="st-billing-label">Current plan</p>
          <div className="st-billing-planrow">
            <div>
              <p className="st-billing-name">
                {formatPlanName(shownPlan)}
                <span className={`st-pill ${statusPill.tone}`}>{statusPill.text}</span>
              </p>
              <p className="st-billing-price">
                <strong>${cycle === "yearly" ? planDefinition.priceYearly : planDefinition.priceMonthly}</strong>{" "}
                per {cycle === "yearly" ? "year" : "month"}
              </p>
            </div>
            <UpgradeIllustration className="upg-art-mini" />
          </div>
          {shownPlan !== "free" && (
            <dl className="bl-facts">
              <div>
                <dt>{state === "expired" || state === "grace" ? "Ended" : "Paid until"}</dt>
                <dd>{subscription.paid_until ? formatDate(subscription.paid_until) : "No end date"}</dd>
              </div>
              {subscription.paid_until && state !== "expired" && (
                <div>
                  <dt>Pay by</dt>
                  <dd>{formatDate(state === "grace" ? graceEnd : subscription.paid_until)}</dd>
                </div>
              )}
              <div>
                <dt>Billing</dt>
                <dd>{subscription.billing_cycle === "yearly" ? "Yearly" : "Monthly"} · manual</dd>
              </div>
            </dl>
          )}
          <p className="st-hint">{planDefinition.description}</p>
        </section>

        <section className="st-billing-usage" aria-label="Usage">
          <p className="st-billing-label">Usage</p>
          {usage.map((row) => {
            const percent =
              row.used === null || !row.limit ? 0 : Math.min(100, Math.round((row.used / row.limit) * 100));
            const tone = percent >= 100 ? " st-usage-fill-full" : percent >= 80 ? " st-usage-fill-warn" : "";
            return (
              <div key={row.label} className="st-usage-item">
                <div className="st-usage-line">
                  <span>{row.label}</span>
                  <strong>
                    {row.used === null ? "…" : row.used.toLocaleString()} /{" "}
                    {row.limit === null ? "Unlimited" : row.limit.toLocaleString()}
                  </strong>
                </div>
                <div
                  className="st-usage-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label={`${row.label} used on your plan`}
                >
                  <div className={`st-usage-fill${tone}`} style={{ width: `${Math.max(percent, row.used ? 2 : 0)}%` }} />
                </div>
              </div>
            );
          })}
          {full.length > 0 && (
            <p className="st-billing-alert" role="status">
              <UiIcon name="alert" className="h-4 w-4 shrink-0" />
              <span>
                You&apos;ve reached your plan limit for {full.map((row) => row.label.toLowerCase()).join(", ")}. Your
                business is growing: upgrade to keep adding.
              </span>
            </p>
          )}
        </section>
      </div>

      {/* ---- the plans, on this page ---- */}
      <section className="bl-card" aria-labelledby="bl-plans-title">
        <div className="bl-card-head">
          <div>
            <h2 id="bl-plans-title" className="bl-card-title">
              Plans
            </h2>
            <p className="bl-card-sub">Pick a plan, pay by Whish, OMT or USDT, and send us the receipt.</p>
          </div>
          <div className="bl-cycle" role="radiogroup" aria-label="Billing period">
            {(["monthly", "yearly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={cycle === option}
                className={`bl-cycle-btn${cycle === option ? " bl-cycle-on" : ""}`}
                onClick={() => setCycle(option)}
              >
                {option === "monthly" ? "Monthly" : "Yearly"}
                {option === "yearly" && <span className="bl-save">2 months free</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="bl-plans">
          {(["free", "standard", "pro"] as const).map((id) => {
            const plan = PLAN_DEFINITIONS[id];
            const current = shownPlan === id && state !== "expired";
            const price = cycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
            return (
              <article key={id} className={`bl-plan${plan.featured ? " bl-plan-featured" : ""}${current ? " bl-plan-current" : ""}`}>
                {plan.featured && <span className="bl-plan-flag">Most popular</span>}
                <p className="bl-plan-name">{plan.name}</p>
                <p className="bl-plan-price">
                  <strong>${price}</strong> / {cycle === "yearly" ? "year" : "month"}
                </p>
                <p className="bl-plan-desc">{plan.description}</p>
                <ul className="bl-plan-list">
                  {plan.highlights.map((line) => (
                    <li key={line}>
                      <UiIcon name="check" className="h-3.5 w-3.5 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <span className="bl-plan-current-tag">
                    {id === "free" ? "Your plan" : state === "grace" || state === "due_soon" ? "Your plan · renew" : "Your plan"}
                  </span>
                ) : id === "free" ? (
                  <span className="bl-plan-muted">Always free</span>
                ) : (
                  <Button size="sm" variant={plan.featured ? "primary" : "secondary"} onClick={() => setPayFor(id)}>
                    {shownPlan === id ? "Renew" : `Choose ${plan.name}`}
                  </Button>
                )}
                {current && id !== "free" && (state === "grace" || state === "due_soon") && (
                  <Button size="sm" onClick={() => setPayFor(id)}>
                    Renew {plan.name}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ---- how to pay ---- */}
      <section className="bl-card" aria-labelledby="bl-pay-title">
        <h2 id="bl-pay-title" className="bl-card-title">
          How to pay
        </h2>
        <ol className="bl-steps">
          <li>
            <span>1</span>Send the amount by Whish Money, OMT or USDT.
          </li>
          <li>
            <span>2</span>Send us the receipt on WhatsApp.
          </li>
          <li>
            <span>3</span>We turn your plan on, usually the same day.
          </li>
        </ol>
        <div className="bl-ways">
          {payWays.map((way) => (
            <div key={way.key} className="bl-way">
              <span className={`bl-way-mark bl-way-${way.key}`} aria-hidden="true">
                {way.mark}
              </span>
              <div className="min-w-0">
                <p className="bl-way-name">{way.name}</p>
                <p className="bl-way-detail">{way.detail}</p>
                <p className="bl-way-sub">{way.sub}</p>
              </div>
              <button type="button" className="bl-copy" onClick={() => void copy(way.copyText, way.name)}>
                Copy
              </button>
            </div>
          ))}
        </div>
        <a
          className="bl-whatsapp"
          href={whatsappFor(renewPlan)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <UiIcon name="chat" className="h-4 w-4" />
          Send receipt on WhatsApp · {SYDIN_WHATSAPP_DISPLAY}
        </a>
        <p className="st-hint">
          If a payment is late you keep full access for {BILLING_GRACE_DAYS} days. After that the account uses Free
          limits until you pay. Your data is never deleted.
        </p>
      </section>

      {/* ---- history ---- */}
      <section className="bl-card" aria-labelledby="bl-history-title">
        <h2 id="bl-history-title" className="bl-card-title">
          Payment history
        </h2>
        {payments === null ? (
          <p className="st-hint">Loading…</p>
        ) : payments.length === 0 ? (
          <div className="bl-empty">
            <UiIcon name="receipt" className="h-6 w-6" />
            <p>No payments yet. When you pay, each one shows here with its period.</p>
          </div>
        ) : (
          <div className="bl-table-wrap">
            <table className="bl-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Period</th>
                  <th scope="col">Paid by</th>
                  <th scope="col" className="bl-num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.paid_at)}</td>
                    <td>
                      {formatPlanName(payment.plan)}
                      <span className="bl-cycle-tag">{payment.billing_cycle === "yearly" ? "Yearly" : "Monthly"}</span>
                    </td>
                    <td>
                      {formatDate(payment.period_start)} – {formatDate(payment.period_end)}
                    </td>
                    <td>
                      {payment.method || "—"}
                      {payment.reference && <span className="bl-ref">#{payment.reference}</span>}
                    </td>
                    <td className="bl-num">{formatMoney(payment.amount, payment.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- what's included ---- */}
      <section className="st-billing-features" aria-label="What your plan includes">
        <p className="st-billing-label">What your plan includes</p>
        <ul className="st-features">
          {included.map(([label, yes]) => (
            <li key={label} className={yes ? undefined : "st-feature-off"}>
              <span className={`st-feature-mark ${yes ? "st-feature-yes" : ""}`} aria-hidden="true">
                {yes ? <UiIcon name="check" className="h-3 w-3" /> : <span className="st-dash" />}
              </span>
              <span className="min-w-0 flex-1">{label}</span>
              {!yes && <span className="st-pill st-pill-grey">Higher plan</span>}
              <span className="sr-only">{yes ? "included" : "not included"}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- pay dialog: same page, no navigation ---- */}
      <DialogShell
        open={payFor !== null}
        eyebrow="Pay for your plan"
        title={payFor ? `${formatPlanName(payFor)} · $${cycle === "yearly" ? PLAN_DEFINITIONS[payFor].priceYearly : PLAN_DEFINITIONS[payFor].priceMonthly} per ${cycle === "yearly" ? "year" : "month"}` : ""}
        description="Send the amount one of these ways, then send us the receipt on WhatsApp. Your plan turns on as soon as we confirm it."
        onClose={() => setPayFor(null)}
        footer={
          payFor ? (
            <>
              <Button variant="secondary" onClick={() => setPayFor(null)}>
                Close
              </Button>
              <a className="bl-whatsapp bl-whatsapp-inline" href={whatsappFor(payFor)} target="_blank" rel="noopener noreferrer">
                <UiIcon name="chat" className="h-4 w-4" />
                I paid, send receipt
              </a>
            </>
          ) : null
        }
      >
        <div className="bl-ways bl-ways-dialog">
          {payWays.map((way) => (
            <div key={way.key} className="bl-way">
              <span className={`bl-way-mark bl-way-${way.key}`} aria-hidden="true">
                {way.mark}
              </span>
              <div className="min-w-0">
                <p className="bl-way-name">{way.name}</p>
                <p className="bl-way-detail">{way.detail}</p>
                <p className="bl-way-sub">{way.sub}</p>
              </div>
              <button type="button" className="bl-copy" onClick={() => void copy(way.copyText, way.name)}>
                Copy
              </button>
            </div>
          ))}
        </div>
      </DialogShell>
    </div>
  );
}
