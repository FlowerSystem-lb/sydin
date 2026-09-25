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
import { Badge, Button, SearchInput, buttonClassName } from "@/components/ui";
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
 * Rebuilt 25 Sep after a founder-supplied reference design: a big friendly
 * question, a "Popular articles" shortcut grid for the six most-asked jobs,
 * one always-visible row of topic chips (icon + count) that filters one
 * always-visible list -- not two different ways to get to the same
 * articles, which is what a separate "browse by topic" tile grid used to be
 * next to these same chips. Every row still ends on the button that does
 * the thing, and answers stay grouped the way the sidebar is grouped.
 */

const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

/** A rough, honest estimate -- not tracked reading data, just "how long is this". */
function readMinutes(article: HelpArticle) {
  return Math.max(1, Math.ceil(article.steps.length / 2));
}

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
          <span className="help-article-title-row">
            <span className="block text-sm font-semibold text-theme-primary">
              {article.title}
            </span>
            {article.popular && (
              <Badge tone="accent" className="help-popular-badge">
                Popular
              </Badge>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-theme-muted">
            {category?.label}
            {" · "}
            {article.summary}
          </span>
        </span>
        <span className="help-article-meta">
          <span className="help-article-time">{readMinutes(article)} min read</span>
          <UiIcon
            name="chevron-down"
            className={`h-4 w-4 shrink-0 text-theme-subtle transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
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
  const browseLabel =
    category === "all"
      ? "All"
      : HELP_CATEGORIES.find((entry) => entry.id === category)?.label ?? "All";

  // Used by the popular-articles shortcuts: always open (never toggle closed)
  // and jump to it. Only reachable from the unfiltered landing view, where
  // the list below is every article, so the target is always on screen.
  const openArticle = (id: string) => {
    setOpenId(id);
    window.requestAnimationFrame(() => {
      document.getElementById(`help-${id}`)?.scrollIntoView({ block: "center" });
    });
  };

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
          <DashboardCard className="help-hero">
            <h1 className="help-hero-title">How can we help?</h1>
            <p className="help-hero-subtitle">
              Step-by-step answers for every job in SydIN — and a way to reach
              us when a page is not enough.
            </p>
            <SearchInput
              id="help-search"
              label="Search help"
              value={query}
              onChange={setQuery}
              placeholder="e.g. receive a delivery, record a payment, print labels…"
              className="help-hero-search mt-3"
              autoFocus
            />
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

          {/* A fast lane to the six most-asked jobs -- only on the plain
              landing view; once you are searching or already on a topic, the
              full list right below is doing that job. */}
          {!searching && category === "all" && (
            <section aria-labelledby="help-popular-title">
              <h2 id="help-popular-title" className="help-section-title">
                Popular articles
              </h2>
              <div className="help-popular-grid mt-2">
                {popular.map((article) => {
                  const articleCategory = HELP_CATEGORIES.find(
                    (entry) => entry.id === article.category
                  );
                  return (
                    <button
                      key={article.id}
                      type="button"
                      className="help-popular-card"
                      onClick={() => openArticle(article.id)}
                    >
                      <span className="help-popular-icon">
                        {articleCategory && (
                          <UiIcon name={articleCategory.icon} className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-theme-primary">
                          {article.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-theme-muted">
                          {articleCategory?.label}
                        </span>
                      </span>
                      <UiIcon
                        name="chevron-right"
                        className="help-popular-chevron h-4 w-4 shrink-0"
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Browse by topic: the one way to narrow the list below, an icon
              and a live count on every chip. */}
          <FilterBar label="Help topics" className="help-topics-bar">
            <FilterChip
              active={category === "all"}
              count={HELP_ARTICLES.length}
              onClick={() => setCategory("all")}
            >
              All
            </FilterChip>
            {HELP_CATEGORIES.map((entry) => {
              const count = HELP_ARTICLES.filter(
                (article) => article.category === entry.id
              ).length;
              return (
                <FilterChip
                  key={entry.id}
                  active={category === entry.id}
                  count={count}
                  onClick={() => setCategory(entry.id)}
                >
                  <UiIcon name={entry.icon} className="h-3.5 w-3.5" />
                  {entry.label}
                </FilterChip>
              );
            })}
          </FilterBar>

          {/* The answers -- always the full (filtered) list, never a
              separate empty-state layout to relearn once you search. */}
          {results.length === 0 ? (
            <DashboardEmptyState
              icon="search"
              title="Nothing matches that yet"
              description="Try another word for it, or ask us directly below — the answer becomes an article."
            />
          ) : (
            <section aria-label="Help articles" className="grid gap-2">
              <p className="text-xs font-semibold text-theme-muted" role="status">
                {results.length} article{results.length === 1 ? "" : "s"} in {browseLabel}
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
          )}

          {/* A person. */}
          <DashboardCard className="help-contact">
            <p className="help-section-title">Still stuck?</p>
            <h2 className="help-contact-title">Talk to a real person</h2>
            <p className="help-contact-copy">
              Email or WhatsApp and a person replies — usually the same day
              during early access, though not instantly. The message is
              pre-filled with your business name and plan only, never your
              stock.
            </p>
            <div className="help-contact-grid">
              <a href={mailtoUrl} className="help-contact-tile">
                <span className="help-contact-tile-icon">
                  <UiIcon name="mail" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-theme-primary">
                    Email support
                  </span>
                  <span className="block text-xs text-theme-muted">{SYDIN_SUPPORT_EMAIL}</span>
                </span>
                <UiIcon name="chevron-right" className="help-popular-chevron h-4 w-4 shrink-0" />
              </a>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="help-contact-tile">
                <span className="help-contact-tile-icon">
                  <UiIcon name="chat" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-theme-primary">
                    WhatsApp us
                  </span>
                  <span className="block text-xs text-theme-muted">{SYDIN_WHATSAPP_DISPLAY}</span>
                </span>
                <UiIcon name="chevron-right" className="help-popular-chevron h-4 w-4 shrink-0" />
              </a>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => void copyContact("whatsapp", SYDIN_WHATSAPP_DISPLAY)}
            >
              {copied === "whatsapp" ? "Number copied" : "Copy WhatsApp number"}
            </Button>
          </DashboardCard>
        </DashboardPageShell>
      </main>
    </div>
  );
}
