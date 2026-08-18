"use client";

import { useState } from "react";
import PlanCtaLink from "@/components/PlanCtaLink";
import Reveal from "@/components/Reveal";
import {
  PLAN_DEFINITIONS,
  PUBLIC_PLAN_ORDER,
  type PlanDefinition,
} from "@/app/lib/subscription";

export type BillingPeriod = "monthly" | "yearly";

// Recomputed from the plan definitions rather than imported from Marketing.tsx,
// which would drag that whole server module (hero, footer, previews) into the
// client bundle just to read three objects.
const plans = PUBLIC_PLAN_ORDER.map((planId) => PLAN_DEFINITIONS[planId]);

function planPrice(plan: PlanDefinition, billing: BillingPeriod) {
  return billing === "yearly" ? plan.priceYearly : plan.priceMonthly;
}

/**
 * Pricing grid with a monthly/yearly switch.
 *
 * Defaults to yearly: plans are activated by hand over Whish Money or OMT, so
 * a yearly customer means one transfer instead of twelve for both sides -- and
 * it shows the lower effective monthly figure, which is the fairer number to
 * lead with.
 */
export default function PricingCardsClient({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [billing, setBilling] = useState<BillingPeriod>("yearly");

  return (
    <>
      <div
        className="marketing-billing-toggle"
        role="group"
        aria-label="Billing period"
      >
        {(["monthly", "yearly"] as const).map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setBilling(period)}
            aria-pressed={billing === period}
            className={
              billing === period ? "marketing-billing-toggle-active" : undefined
            }
          >
            {period === "monthly" ? "Monthly" : "Yearly"}
            {period === "yearly" && (
              <span className="marketing-billing-save">2 months free</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map((plan, index) => (
        <Reveal key={plan.name} delay={index * 80}>
          <div
            className={`marketing-pricing-card flex h-full flex-col p-6 ${
              plan.featured
                ? "marketing-pricing-card-featured"
                : ""
            }`}
          >
            <div className="mb-5 flex min-h-7 items-center justify-between gap-3">
              {plan.featured ? (
                <span className="marketing-plan-badge">
                  Most popular
                </span>
              ) : (
                <span />
              )}

              {!plan.available && (
                <span className="marketing-plan-badge">
                  Future
                </span>
              )}
            </div>

            <h3 className="text-2xl font-bold text-slate-950">
              {plan.name}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {plan.description}
            </p>

            <div className="mt-6 flex items-end gap-1">
              <span className="text-5xl font-bold text-slate-950">
                {planPrice(plan, billing) === null
                  ? "Custom"
                  : `$${planPrice(plan, billing)}`}
              </span>
              {planPrice(plan, billing) !== null && (
                <span className="pb-2 text-sm font-bold text-slate-500">
                  {billing === "yearly" ? "/year" : "/month"}
                </span>
              )}
            </div>

            {/* Only shown where it is actually true: paid plans on yearly.
                Printing "save $0" under Free would be noise. */}
            {billing === "yearly" &&
              plan.priceMonthly !== null &&
              plan.priceMonthly > 0 && (
                <p className="marketing-price-note">
                  ${plan.priceMonthly}/month billed yearly &mdash; two months
                  free
                </p>
              )}

            <ul className={`mt-6 space-y-3 ${compact ? "text-sm" : "text-base"}`}>
              {plan.highlights.map((feature) => (
                <li
                  key={feature}
                  className="flex gap-3 text-slate-600"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {plan.available ? (
              <PlanCtaLink
                plan={plan.id}
                className={`marketing-button mt-8 min-h-12 px-5 py-3 text-sm ${
                  plan.featured
                    ? "marketing-button-primary"
                    : "marketing-button-secondary"
                }`}
              >
                {plan.ctaLabel}
              </PlanCtaLink>
            ) : (
              <span className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-black text-slate-500">
                {plan.ctaLabel}
              </span>
            )}
          </div>
        </Reveal>
      ))}
      </div>
    </>
  );
}
