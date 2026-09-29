"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { PLAN_DEFINITIONS, type UpgradePlan } from "@/app/lib/subscription";
import UpgradeIllustration from "@/components/UpgradeIllustration";

interface UpgradePromptProps {
  feature: string;
  benefit: string;
  currentPlan: string;
  requiredPlan: UpgradePlan;
  source: string;
  compact?: boolean;
}

interface UpgradeDialogProps extends UpgradePromptProps {
  open: boolean;
  onClose: () => void;
}

function LockIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function getRequestHref(requiredPlan: UpgradePlan, source: string) {
  if (requiredPlan === "Contact") {
    return `/contact?source=${encodeURIComponent(source)}`;
  }

  return `/request-plan?plan=${requiredPlan.toLowerCase()}&source=${encodeURIComponent(source)}`;
}

function UpgradeActions({
  requiredPlan,
  source,
}: Pick<UpgradePromptProps, "requiredPlan" | "source">) {
  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={getRequestHref(requiredPlan, source)}
          className="glass-button min-h-12 flex-1 rounded-2xl px-5 py-3 text-center text-sm"
        >
          {requiredPlan === "Contact"
            ? "Contact SydIN"
            : `Request ${requiredPlan}`}
        </Link>
        {/* Sentence case, like every other button in the app: "Save item",
            "Save settings", "Add invoice image". This was the only Title Case
            one. */}
        <Link
          href="/pricing"
          className="glass-button glass-button-secondary min-h-12 flex-1 rounded-2xl px-5 py-3 text-center text-sm"
        >
          Compare plans
        </Link>
      </div>

      {/* The button used to be the end of it: press "Request Pro" and find out
          what that meant afterwards. This is the highest-stakes click in the
          product, and nobody presses a button whose outcome they cannot
          predict.

          Worded from what /request-plan actually does -- review, then contact
          by email or WhatsApp, then activation once payment is arranged. No
          turnaround time is promised here, because none is promised there,
          and inventing one would be a commitment the business has not made. */}
      <p className="mt-3 text-xs font-semibold leading-5 text-theme-muted">
        {requiredPlan === "Contact"
          ? "We reply by email or WhatsApp to work out what you need. Nothing is charged automatically."
          : "We reply by email or WhatsApp to set it up, and payment is arranged with you directly. Nothing is charged automatically."}
      </p>
    </div>
  );
}

export function LockedFeaturePanel({
  feature,
  benefit,
  currentPlan,
  requiredPlan,
  source,
  compact = false,
}: UpgradePromptProps) {
  return (
    /* Was a one-off: `rounded-[28px]`, a hand-written radial-gradient
       background, `backdrop-blur-2xl` and `shadow-[0_24px_90px_rgba(0,5,20,0.3)]`
       -- four arbitrary values in one className, matching no other card in the
       app. On a page full of `dashboard-card` surfaces it read as a component
       from a different product, which is the last impression a paywall should
       give. Same surface as everything else now; the lock and the accent
       eyebrow are what mark it out. */
    <section
      className={`dashboard-card overflow-hidden ${compact ? "p-5" : "p-6 sm:p-8"}`}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-theme bg-theme-inset text-theme-accent">
          <LockIcon />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-theme-accent">
            {requiredPlan === "Contact" ? "Plan capacity" : `${requiredPlan} feature`}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-theme-primary">
            {feature}
          </h2>
          <p className="mt-2 text-sm leading-6 text-theme-muted">{benefit}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="neutral">Current: {currentPlan}</Badge>
            <Badge tone="accent">
              {requiredPlan === "Contact"
                ? "Next step: Contact SydIN"
                : `Required: ${requiredPlan}`}
            </Badge>
          </div>
        </div>
      </div>
      <UpgradeActions requiredPlan={requiredPlan} source={source} />
    </section>
  );
}

export function UpgradeDialog({
  open,
  onClose,
  ...prompt
}: UpgradeDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  // Rendered into <body>, like DialogShell: the dashboard workspace uses
  // container queries (layout containment), which traps position: fixed and
  // left this dialog sitting at the bottom of the page instead of the screen,
  // under the phone tab bar.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  if (!open || !isClient) return null;

  /* 29 Sep (Sayed, after Sortly's "Do even more with our Advanced plan"):
     a picture on the left, and on the right what the plan actually gives --
     the same highlights the pricing page uses, so the two never disagree. */
  const planId =
    prompt.requiredPlan === "Pro" ? "pro" : prompt.requiredPlan === "Standard" ? "standard" : null;
  const plan = planId ? PLAN_DEFINITIONS[planId] : null;

  return createPortal(
    <div className="upg-overlay theme-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-dialog-title"
        className="upg-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <UpgradeIllustration />

        <div className="upg-body">
          <button type="button" onClick={onClose} className="upg-close" aria-label="Close upgrade dialog">
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          <p className="upg-eyebrow">
            <LockIcon className="h-3.5 w-3.5" />
            {prompt.feature}
          </p>
          <h2 id="upgrade-dialog-title" className="upg-title">
            {plan ? (
              <>
                Do even more with <span>{plan.name}</span>
              </>
            ) : (
              <>Let&apos;s find the right plan</>
            )}
          </h2>
          <p className="upg-benefit">{prompt.benefit}</p>

          {plan && (
            <ul className="upg-list">
              {plan.highlights.map((line) => (
                <li key={line}>
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="upg-check">
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
          )}

          {plan && (
            <p className="upg-price">
              <strong>${plan.priceMonthly}</strong> / month · You are on {prompt.currentPlan}
            </p>
          )}

          <div className="upg-actions">
            <Link href={getRequestHref(prompt.requiredPlan, prompt.source)} className="upg-primary">
              {prompt.requiredPlan === "Contact" ? "Contact SydIN" : `Upgrade to ${prompt.requiredPlan}`}
            </Link>
            <Link href="/pricing" className="upg-secondary">
              Compare plans
            </Link>
          </div>
          <p className="upg-note">
            We reply by email or WhatsApp and arrange payment with you directly. Nothing is charged automatically.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function LockedActionLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LockIcon className="h-4 w-4" />
      {children}
    </>
  );
}
