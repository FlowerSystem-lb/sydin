"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { UpgradePlan } from "@/app/lib/subscription";

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
  if (requiredPlan === "Business") {
    return `/contact?source=${encodeURIComponent(source)}`;
  }

  return `/request-plan?plan=${requiredPlan}&source=${encodeURIComponent(source)}`;
}

function UpgradeActions({
  requiredPlan,
  source,
}: Pick<UpgradePromptProps, "requiredPlan" | "source">) {
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <Link
        href={getRequestHref(requiredPlan, source)}
        className="glass-button min-h-12 flex-1 rounded-2xl px-5 py-3 text-center text-sm"
      >
        {requiredPlan === "Business"
          ? "Contact SydIN"
          : `Request ${requiredPlan}`}
      </Link>
      <Link
        href="/pricing"
        className="glass-button glass-button-secondary min-h-12 flex-1 rounded-2xl px-5 py-3 text-center text-sm"
      >
        Compare Plans
      </Link>
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
    <section
      className={`overflow-hidden rounded-[28px] border border-sky-300/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_42%),rgba(255,255,255,0.045)] shadow-[0_24px_90px_rgba(0,5,20,0.3)] backdrop-blur-2xl ${
        compact ? "p-5" : "p-6 sm:p-8"
      }`}
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-sky-400/15 text-theme-accent shadow-[0_14px_36px_rgba(14,165,233,0.16)]">
          <LockIcon />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-theme-accent">
            {requiredPlan} feature
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-theme-primary">
            {feature}
          </h2>
          <p className="mt-2 text-sm leading-6 text-theme-muted">{benefit}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="glass-badge text-xs font-bold">
              Current: {currentPlan}
            </span>
            <span className="glass-badge text-xs font-bold">
              Required: {requiredPlan}
            </span>
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-dialog-title"
        className="glass-modal my-8 w-full max-w-lg p-5 sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-sky-400/15 text-theme-accent">
              <LockIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-theme-accent">
                Upgrade SydIN
              </p>
              <h2
                id="upgrade-dialog-title"
                className="mt-1 text-2xl font-black text-theme-primary"
              >
                {prompt.feature}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-theme bg-theme-surface text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary"
            aria-label="Close upgrade dialog"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <p className="mt-5 text-base leading-7 text-theme-secondary">
          {prompt.benefit}
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-theme bg-theme-inset p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
              Current plan
            </p>
            <p className="mt-2 font-black text-theme-primary">{prompt.currentPlan}</p>
          </div>
          <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-accent">
              Required plan
            </p>
            <p className="mt-2 font-black text-theme-primary">{prompt.requiredPlan}</p>
          </div>
        </div>
        <UpgradeActions
          requiredPlan={prompt.requiredPlan}
          source={prompt.source}
        />
      </div>
    </div>
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
