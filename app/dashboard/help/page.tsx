"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import {
  DashboardCard,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  FilterBar,
  FilterChip,
} from "@/components/dashboard/Workspace";
import { Button, SearchInput, buttonClassName } from "@/components/ui";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  searchHelpArticles,
  type HelpArticle,
  type HelpCategoryId,
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

/**
 * The Help Center teaches SydIN by the job in hand.
 *
 * Was: a five-card setup checklist, nine "quick guides" that were sidebar
 * links with a sentence each, two accordions, and a support panel -- a page
 * you scrolled, not one you asked. Now it opens with one question ("What are
 * you trying to do?"), answers it from a set of step-by-step articles grouped
 * the way the sidebar is grouped, and every article ends on the button that
 * does the thing. The setup checklist stays, folded into Getting started.
 */

const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

function ArticleCard({
  article,
  open,
  onToggle,
}: {
  article: HelpArticle;
  open: boolean;
  onToggle: () => void;
}) {
  const category = HELP_CATEGORIES.find((entry) => entry.id === article.category);
  return (
    <article id={`help-${article.id}`} className={`help-article${open ? " help-article-open" : ""}`}>
      <button
        type="button"
        className="help-article-toggle"
        aria-expanded={open}
        aria-controls={`help-${article.id}-body`}
        onClick={onToggle}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-theme-primary">
            {article.title}
          </span>
          <span className="mt-0.5 block text-xs text-theme-muted">
            {category?.label}
            {" · "}
            {article.summary}
          </span>
        </span>
        <UiIcon
          name="chevron-down"
          className={`h-4 w-4 shrink-0 text-theme-subtle transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div id={`help-${article.id}-body`} className="help-article-body">
          <ol className="help-steps">
            {article.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          {article.note && <p className="help-note">{article.note}</p>}
          {article.href && article.action && (
            <Link
              href={article.href}
              className={buttonClassName({ variant: "secondary", size: "sm", className: "mt-3" })}
            >
              {article.action}
              <UiIcon name="chevron-right" className="ml-1 h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

export default function HelpCenterPage() {
  const searchParams = useSearchParams();
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [usage, setUsage] = useState<SubscriptionUsage>(DEFAULT_USAGE);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"email" | "whatsapp" | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategoryId | "all">("all");
  // A "What is this?" link elsewhere lands here with ?article=<id>: that
  // article opens, and its category is selected so it is in view.
  const [openId, setOpenId] = useState<string | null>(() => {
    const requested = searchParams.get("article");
    return requested && HELP_ARTICLES.some((article) => article.id === requested)
      ? requested
      : null;
  });

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user }, error: userError }) => {
        if (!isActive) return;
        if (userError || !user) {
          setError("Please sign in again to open the Help Center.");
          return;
        }

        const [settingsResult, usageResult, onboardingResult] =
          await Promise.allSettled([
            getOrCreateBusinessSettings(user.id),
            getSubscriptionUsage(user.id),
            getOnboardingProgress(user.id),
          ]);
        if (!isActive) return;

        if (settingsResult.status === "fulfilled") setBusinessSettings(settingsResult.value);
        if (usageResult.status === "fulfilled") setUsage(usageResult.value);
        if (onboardingResult.status === "fulfilled") setOnboarding(onboardingResult.value);
      })
      .catch(() => {
        if (isActive) setError("We could not confirm your session. Please sign in again.");
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!openId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`help-${openId}`)?.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
    // Only on arrival: scrolling on every toggle would yank the page around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searching = query.trim().length > 0;
  const results = useMemo(() => {
    const matched = searchHelpArticles(query);
    return category === "all"
      ? matched
      : matched.filter((article) => article.category === category);
  }, [query, category]);
  const popular = HELP_ARTICLES.filter((article) => article.popular);

  const currentPlanName = formatPlanName(usage.subscription.plan);
  const mailtoUrl = buildSupportMailtoUrl({
    businessName: businessSettings.business_name,
    planName: currentPlanName,
  });
  const whatsappUrl = buildSupportWhatsAppUrl({
    businessName: businessSettings.business_name,
    planName: currentPlanName,
  });

  const copyContact = async (type: "email" | "whatsapp", value: string) => {
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

  const nextStep = onboarding?.nextStep ?? null;
  const setupDone = onboarding ? onboarding.completedCount >= onboarding.totalCount : false;

  return (
    <div className="contents">
      <main className="support-workspace support-help">
        <DashboardPageShell width="compact">
          <DashboardPageHeader
            eyebrow="Help Center"
            title="Help"
            description="Step-by-step answers for every job in SydIN, and a way to reach us when a page is not enough."
          />

          {error && <DashboardNotice tone="danger">{error}</DashboardNotice>}

          {/* The question. */}
          <DashboardCard className="help-ask">
            <label htmlFor="help-search" className="help-ask-label">
              What are you trying to do?
            </label>
            <SearchInput
              id="help-search"
              label="Search help"
              value={query}
              onChange={setQuery}
              placeholder="receive a delivery, record a payment, print labels…"
              className="mt-2 w-full"
              autoFocus
            />
            <FilterBar label="Help topics" className="mt-3">
              <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
                All
              </FilterChip>
              {HELP_CATEGORIES.map((entry) => (
                <FilterChip
                  key={entry.id}
                  active={category === entry.id}
                  onClick={() => setCategory(entry.id)}
                >
                  {entry.label}
                </FilterChip>
              ))}
            </FilterBar>
          </DashboardCard>

          {/* Setup progress, only while there is something left to do. */}
          {onboarding && !setupDone && !searching && category === "all" && (
            <DashboardCard className="help-setup">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                    Getting started · {onboarding.completedCount} of {onboarding.totalCount} done
                  </p>
                  {nextStep && (
                    <p className="mt-1 text-sm font-semibold text-theme-primary">
                      Next: {nextStep.title}
                    </p>
                  )}
                </div>
                {nextStep && (
                  <Link href={nextStep.href} className={buttonClassName({ size: "sm" })}>
                    {nextStep.action}
                  </Link>
                )}
              </div>
              <div
                className="po-progress-track mt-3"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={onboarding.percentage}
                aria-label="Setup progress"
              >
                <div className="po-progress-fill" style={{ width: `${onboarding.percentage}%` }} />
              </div>
            </DashboardCard>
          )}

          {/* Answers. */}
          {searching || category !== "all" ? (
            results.length === 0 ? (
              <DashboardEmptyState
                icon="search"
                title="Nothing matches that yet"
                description="Try another word for it, or ask us directly below — the answer becomes an article."
              />
            ) : (
              <section aria-label="Help articles" className="grid gap-2">
                <p className="text-xs font-semibold text-theme-muted" role="status">
                  {results.length} article{results.length === 1 ? "" : "s"}
                </p>
                {results.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    open={openId === article.id}
                    onToggle={() =>
                      setOpenId((current) => (current === article.id ? null : article.id))
                    }
                  />
                ))}
              </section>
            )
          ) : (
            <>
              <section aria-labelledby="help-popular-title" className="grid gap-2">
                <h2 id="help-popular-title" className="help-section-title">
                  Most asked
                </h2>
                {popular.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    open={openId === article.id}
                    onToggle={() =>
                      setOpenId((current) => (current === article.id ? null : article.id))
                    }
                  />
                ))}
              </section>

              <section aria-labelledby="help-browse-title">
                <h2 id="help-browse-title" className="help-section-title">
                  Browse by what you are doing
                </h2>
                <div className="help-topic-grid mt-2">
                  {HELP_CATEGORIES.map((entry) => {
                    const count = HELP_ARTICLES.filter(
                      (article) => article.category === entry.id
                    ).length;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className="help-topic"
                        onClick={() => setCategory(entry.id)}
                      >
                        <span className="block text-sm font-semibold text-theme-primary">
                          {entry.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-theme-muted">
                          {entry.blurb}
                        </span>
                        <span className="mt-2 block text-xs font-semibold text-theme-accent">
                          {count} article{count === 1 ? "" : "s"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* A person. */}
          <DashboardCard className="help-contact">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h2 className="help-section-title">Still stuck? Ask us</h2>
                <p className="mt-1 max-w-prose text-sm text-theme-muted">
                  Email or WhatsApp and a person replies — usually the same day
                  during early access, though not instantly. The message is
                  pre-filled with your business name and plan only, never your
                  stock.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={mailtoUrl} className={buttonClassName({ size: "sm" })}>
                  Email {SYDIN_SUPPORT_EMAIL}
                </a>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  WhatsApp {SYDIN_WHATSAPP_DISPLAY}
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyContact("whatsapp", SYDIN_WHATSAPP_DISPLAY)}
                >
                  {copied === "whatsapp" ? "Number copied" : "Copy number"}
                </Button>
              </div>
            </div>
          </DashboardCard>
        </DashboardPageShell>
      </main>
    </div>
  );
}
