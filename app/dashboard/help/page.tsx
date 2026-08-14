"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ActionButton,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import {
  FAQ_ITEMS,
  QUICK_GUIDES,
  TROUBLESHOOTING_ITEMS,
  type HelpExpandableItem,
} from "@/app/lib/helpContent";
import {
  getOnboardingProgress,
  type OnboardingProgress,
} from "@/app/lib/onboarding";
import {
  buildSupportMailtoUrl,
  buildSupportWhatsAppUrl,
  SYDIN_SUPPORT_EMAIL,
  SYDIN_WHATSAPP_DISPLAY,
} from "@/app/lib/support";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionUsage,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";

const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

function ExpandableHelpCard({ item }: { item: HelpExpandableItem }) {
  return (
    <details className="group rounded-2xl border border-theme bg-theme-inset open:border-[#2563eb]/20 open:bg-[#2563eb]/[0.06]">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold text-theme-primary outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/60">
        <span>{item.title}</span>
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-theme bg-theme-surface text-lg text-theme-accent transition group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="border-t border-theme px-5 pb-5 pt-4">
        <p className="leading-7 text-theme-muted">{item.body}</p>
        {item.href && item.action && (
          <Link
            href={item.href}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-[#2563eb]/20 bg-[#2563eb]/10 px-4 py-2 text-sm font-bold text-theme-accent transition hover:bg-[#2563eb]/20"
          >
            {item.action}
          </Link>
        )}
      </div>
    </details>
  );
}

export default function HelpCenterPage() {
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [usage, setUsage] = useState<SubscriptionUsage>(DEFAULT_USAGE);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"email" | "whatsapp" | null>(null);

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user }, error: userError }) => {
        if (!isActive) return;

        if (userError || !user) {
          setError("Please sign in again to open the Help Center.");
          setLoading(false);
          return;
        }

        const [settingsResult, usageResult, onboardingResult] =
          await Promise.allSettled([
            getOrCreateBusinessSettings(user.id),
            getSubscriptionUsage(user.id),
            getOnboardingProgress(user.id),
          ]);

        if (!isActive) return;

        if (settingsResult.status === "fulfilled") {
          setBusinessSettings(settingsResult.value);
        }
        if (usageResult.status === "fulfilled") {
          setUsage(usageResult.value);
        }
        if (onboardingResult.status === "fulfilled") {
          setOnboarding(onboardingResult.value);
        }

        if (
          settingsResult.status === "rejected" &&
          usageResult.status === "rejected" &&
          onboardingResult.status === "rejected"
        ) {
          setError(
            "We could not load your Help Center details. Refresh and try again."
          );
        }

        setLoading(false);
      })
      .catch(() => {
        if (!isActive) return;
        setError("We could not confirm your session. Please sign in again.");
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const currentPlanName = formatPlanName(usage.subscription.plan);
  const mailtoUrl = buildSupportMailtoUrl({
    businessName: businessSettings.business_name,
    planName: currentPlanName,
  });
  const whatsappUrl = buildSupportWhatsAppUrl({
    businessName: businessSettings.business_name,
    planName: currentPlanName,
  });

  const copyContact = async (
    type: "email" | "whatsapp",
    value: string
  ) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => {
        setCopied((current) => (current === type ? null : current));
      }, 1800);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="contents">
      <main className="support-workspace support-help">
        <DashboardPageShell>
          <DashboardPageHeader
            eyebrow="Guidance and support"
            title="Help Center"
            description="How can we help? Follow the recommended setup steps, learn each SydIN workflow, or contact the team directly."
            actions={
              <div className="rounded-xl border border-[#2563eb]/15 bg-[#2563eb]/[0.07] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-theme-accent">
                  Current workspace
                </p>
                <p className="mt-1.5 max-w-xs truncate font-black text-theme-primary">
                  {loading
                    ? "Loading workspace..."
                    : businessSettings.business_name}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-theme-muted">
                  {currentPlanName} plan
                  {usage.subscription.plan === "pro"
                    ? " / Priority manual support"
                    : ""}
                </p>
              </div>
            }
          />

          {error && <DashboardNotice tone="danger">{error}</DashboardNotice>}

          <section className="dashboard-card">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
                  Recommended setup
                </p>
                <h2 className="mt-2 text-xl font-black">
                  Getting Started
                </h2>
                <p className="mt-3 max-w-2xl leading-7 text-theme-muted">
                  These steps are helpful suggestions, not requirements. Use
                  only the workflows that fit your business.
                </p>
              </div>

              <div className="min-w-52 rounded-2xl border border-theme bg-theme-inset p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-theme-muted">
                    Progress
                  </span>
                  <span className="font-black text-theme-primary">
                    {onboarding
                      ? `${onboarding.completedCount}/${onboarding.totalCount}`
                      : "..."}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-theme-surface">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#10c4dc,#2563eb)]"
                    style={{
                      width: `${onboarding?.percentage || 0}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-right text-xs font-black text-theme-accent">
                  {onboarding?.percentage || 0}%
                </p>
              </div>
            </div>

            {loading ? (
              <LoadingSkeletonGroup
                count={5}
                className="mt-6 md:grid-cols-2 xl:grid-cols-5"
                itemClassName="min-h-40"
              />
            ) : onboarding ? (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {onboarding.steps.map((step) => (
                    <article
                      key={step.id}
                      className={`flex min-h-44 flex-col rounded-2xl border p-4 ${
                        step.status === "completed"
                          ? "border-emerald-300/20 bg-emerald-400/[0.08]"
                          : step.status === "unavailable"
                            ? "border-amber-300/20 bg-amber-400/[0.06]"
                            : "border-theme bg-theme-inset"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-black ${
                          step.status === "completed"
                            ? "border-emerald-300/25 bg-emerald-400/15 text-theme-success"
                            : step.status === "unavailable"
                              ? "border-amber-300/25 bg-amber-400/10 text-theme-warning"
                              : "border-theme bg-theme-surface text-theme-secondary"
                        }`}
                      >
                        {step.status === "completed"
                          ? "OK"
                          : step.status === "unavailable"
                            ? "?"
                            : " "}
                      </span>
                      <h3 className="mt-4 font-black text-theme-primary">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-theme-subtle">
                        {step.status === "unavailable"
                          ? "This status could not be checked right now."
                          : step.description}
                      </p>
                      {step.status !== "completed" && (
                        <Link
                          href={step.href}
                          className="mt-auto pt-4 text-sm font-black text-theme-accent transition hover:text-theme-primary"
                        >
                          {step.action}
                        </Link>
                      )}
                    </article>
                  ))}
                </div>

                {onboarding.nextStep ? (
                  <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#2563eb]/20 bg-[#2563eb]/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-theme-accent">
                        Suggested next action
                      </p>
                      <p className="mt-2 text-lg font-black">
                        {onboarding.nextStep.title}
                      </p>
                    </div>
                    <ActionButton href={onboarding.nextStep.href}>
                      {onboarding.nextStep.action}
                    </ActionButton>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] p-5">
                    <p className="font-black text-theme-success">
                      Recommended setup complete
                    </p>
                    <p className="mt-2 text-sm text-theme-muted">
                      Continue with the tools that are useful for your daily
                      workflow.
                    </p>
                  </div>
                )}

                {onboarding.hasPartialError && (
                  <p className="mt-4 text-sm text-theme-warning">
                    Some checklist statuses could not be checked. Your records
                    were not changed.
                  </p>
                )}
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-theme px-5 py-10 text-center text-theme-subtle">
                Setup progress is temporarily unavailable. The guides below
                remain ready to use.
              </div>
            )}
          </section>

          <section>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
                Learn SydIN
              </p>
              <h2 className="mt-2 text-xl font-black">
                Quick Guides
              </h2>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {QUICK_GUIDES.map((guide) => (
                <article
                  key={guide.title}
                  className="dashboard-card flex min-h-52 flex-col"
                >
                  <h3 className="text-xl font-black">{guide.title}</h3>
                  <p className="mt-3 leading-7 text-theme-muted">
                    {guide.description}
                  </p>
                  <Link
                    href={guide.href}
                    className="mt-auto pt-5 text-sm font-black text-theme-accent transition hover:text-theme-primary"
                  >
                    {guide.action}
                  </Link>
                </article>
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-[28px] border border-[#2563eb]/20 bg-[#2563eb]/[0.08] p-5 sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-theme-accent">
                  Optional workflow
                </p>
                <h3 className="mt-2 text-xl font-black">Import inventory</h3>
                <p className="mt-3 leading-7 text-theme-muted">
                  Import is not part of the scored checklist because existing
                  items do not record how they were created.
                </p>
                <Link
                  href="/dashboard/inventory/import"
                  className="mt-5 inline-flex text-sm font-black text-theme-accent"
                >
                  Open Import
                </Link>
              </article>

              <article className="rounded-[28px] border border-[#7d5cff]/20 bg-[#7d5cff]/[0.08] p-5 sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7d5cff]">
                  {usage.subscription.plan === "pro"
                    ? "Advanced workspace"
                    : "Plan options"}
                </p>
                <h3 className="mt-2 text-xl font-black">
                  {usage.subscription.plan === "pro"
                    ? "Explore advanced tools"
                    : "Need more capacity?"}
                </h3>
                <p className="mt-3 leading-7 text-theme-muted">
                  {usage.subscription.plan === "pro"
                    ? "Use reports, analytics, Pick Lists, imports, exports, and advanced organization tools as your workflow grows."
                    : "Plan upgrades increase inventory capacity and unlock additional operational tools. Upgrading is optional."}
                </p>
                <Link
                  href={
                    usage.subscription.plan === "pro"
                      ? "/dashboard/reports"
                      : `/request-plan?plan=${
                          usage.subscription.plan === "free"
                            ? "Standard"
                            : "Pro"
                        }&source=help-center`
                  }
                  className="mt-5 inline-flex text-sm font-black text-[#7d5cff]"
                >
                  {usage.subscription.plan === "pro"
                    ? "Explore Reports"
                    : "Review Upgrade"}
                </Link>
              </article>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="dashboard-card">
              <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-warning">
                Common issues
              </p>
              <h2 className="mt-2 text-xl font-black">Troubleshooting</h2>
              <div className="mt-5 space-y-3">
                {TROUBLESHOOTING_ITEMS.map((item) => (
                  <ExpandableHelpCard key={item.title} item={item} />
                ))}
              </div>
            </div>

            <div className="dashboard-card">
              <p className="text-xs font-black uppercase tracking-[0.17em] text-[#7d5cff]">
                Product questions
              </p>
              <h2 className="mt-2 text-xl font-black">
                Frequently Asked Questions
              </h2>
              <div className="mt-5 space-y-3">
                {FAQ_ITEMS.map((item) => (
                  <ExpandableHelpCard key={item.title} item={item} />
                ))}
              </div>
            </div>
          </section>

          <section className="dashboard-card overflow-hidden">
            <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
                  Direct manual support
                </p>
                <h2 className="mt-2 text-xl font-black">
                  Contact SydIN
                </h2>
                <p className="mt-4 leading-7 text-theme-muted">
                  Send an email or WhatsApp message for account and product
                  help. SydIN currently provides human support during early
                  access and does not promise live-chat or instant response
                  times.
                </p>
                <p className="mt-3 text-sm text-theme-subtle">
                  Prefilled messages include only your business name and plan,
                  never inventory records or item details.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-2xl border border-theme bg-theme-inset p-5">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-theme-subtle">
                    Support email
                  </p>
                  <p className="mt-3 break-all font-black text-theme-primary">
                    {SYDIN_SUPPORT_EMAIL}
                  </p>
                  <div className="mt-5 grid gap-2">
                    <a
                      href={mailtoUrl}
                      className="dashboard-action-button dashboard-action-button-primary"
                    >
                      Email Support
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        void copyContact("email", SYDIN_SUPPORT_EMAIL)
                      }
                      className="rounded-xl border border-theme bg-theme-surface px-4 py-3 text-sm font-bold"
                    >
                      {copied === "email" ? "Email Copied" : "Copy Email"}
                    </button>
                  </div>
                </article>

                <article className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-theme-success">
                    WhatsApp
                  </p>
                  <p className="mt-3 font-black text-theme-primary">
                    {SYDIN_WHATSAPP_DISPLAY}
                  </p>
                  <div className="mt-5 grid gap-2">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-emerald-300/25 bg-emerald-400/15 px-4 py-3 text-center text-sm font-bold text-theme-success transition hover:bg-emerald-400/25"
                    >
                      Message on WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        void copyContact(
                          "whatsapp",
                          SYDIN_WHATSAPP_DISPLAY
                        )
                      }
                      className="rounded-xl border border-theme bg-theme-surface px-4 py-3 text-sm font-bold"
                    >
                      {copied === "whatsapp"
                        ? "Number Copied"
                        : "Copy Number"}
                    </button>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </DashboardPageShell>
      </main>
    </div>
  );
}
