import Link from "next/link";
import Image from "next/image";
import SydINMark from "@/components/brand/SydINMark";
import PlanCtaLink from "@/components/PlanCtaLink";
import Reveal from "@/components/Reveal";
import UiIcon from "@/components/UiIcon";
import {
  PLAN_DEFINITIONS,
  PUBLIC_PLAN_ORDER,
} from "@/app/lib/subscription";

type MarketingSection = "home" | "features" | "pricing" | "demo" | "contact" | "none";

interface MarketingPageProps {
  active?: MarketingSection;
  children: React.ReactNode;
}

interface SectionIntroProps {
  eyebrow: string;
  title: string;
  text: string;
  align?: "left" | "center";
}

interface PricingCardsProps {
  compact?: boolean;
}

const navLinks: Array<{
  label: string;
  href: string;
  key: MarketingSection;
}> = [
  {
    label: "Features",
    href: "/features",
    key: "features",
  },
  {
    label: "Pricing",
    href: "/pricing",
    key: "pricing",
  },
  {
    label: "Demo",
    href: "/demo",
    key: "demo",
  },
  {
    label: "Contact",
    href: "/contact",
    key: "contact",
  },
];

export const pricingPlans = PUBLIC_PLAN_ORDER.map(
  (planId) => PLAN_DEFINITIONS[planId]
);

export const featureCards = [
  {
    title: "Visual inventory",
    text: "Upload product photos so teams can identify items quickly without guessing from a spreadsheet row.",
  },
  {
    title: "QR item pages",
    text: "Generate public item pages and QR codes that make each product easier to scan, share, and verify.",
  },
  {
    title: "Item history",
    text: "Keep a clear record of created, edited, and deleted inventory actions for better operational trust.",
  },
  {
    title: "Low stock tracking",
    text: "Spot items at or below your reorder threshold before stock problems become customer problems.",
  },
  {
    title: "Mobile workflow",
    text: "Use SydIN comfortably on phone, tablet, and desktop when work happens away from the desk.",
  },
  {
    title: "Reports and Pick Lists",
    text: "Review stock health and value, then prepare orders or events with active Pick List limits matched to your plan.",
  },
];

export function MarketingPage({
  active = "home",
  children,
}: MarketingPageProps) {
  return (
    <main className="marketing-site relative min-h-screen overflow-hidden">
      <MarketingHeader active={active} />

      {children}

      <MarketingFooter />
    </main>
  );
}

export function MarketingLogo() {
  return (
    <Link
      href="/"
      className="marketing-logo flex min-w-0 items-center gap-2.5"
      aria-label="SydIN home"
    >
      <Image
        src="/brand/sydin-logo.svg"
        alt=""
        width={132}
        height={40}
        priority
        className="marketing-logo-image object-contain"
      />
    </Link>
  );
}

export function MarketingHeader({
  active,
}: {
  active: MarketingSection;
}) {
  return (
    <header className="marketing-header relative z-20">
      <div className="marketing-announcement px-4 py-2 text-center text-xs font-semibold sm:text-sm">
        Start free with up to 50 inventory items
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <MarketingLogo />

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`marketing-nav-link px-4 py-2.5 text-sm font-semibold ${
                  active === link.key
                    ? "marketing-nav-link-active"
                    : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Link
              href="/login"
              className="marketing-button marketing-button-secondary px-4 py-2.5 text-sm"
            >
              Sign in
            </Link>

            <PlanCtaLink
              plan="free"
              className="marketing-button marketing-button-primary px-5 py-2.5 text-sm"
            >
              Start Free
            </PlanCtaLink>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:hidden">
          <Link
            href="/login"
            className="marketing-button marketing-button-secondary min-h-11 px-3 py-2.5 text-sm"
          >
            Sign in
          </Link>
          <PlanCtaLink
            plan="free"
            className="marketing-button marketing-button-primary min-h-11 px-3 py-2.5 text-sm"
          >
            Start Free
          </PlanCtaLink>
        </div>

        <nav className="grid grid-cols-4 gap-1 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`marketing-nav-link min-h-11 px-2 py-3 text-center text-xs font-semibold ${
                active === link.key
                  ? "marketing-nav-link-active"
                  : ""
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <MarketingLogo />

        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium">
          <Link href="/features">
            Features
          </Link>
          <Link href="/pricing">
            Pricing
          </Link>
          <Link href="/demo">
            Demo
          </Link>
          <Link href="/contact">
            Contact
          </Link>
          <Link href="/privacy">
            Privacy
          </Link>
          <Link href="/terms">
            Terms
          </Link>
          <Link href="/login">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  text,
  align = "center",
}: SectionIntroProps) {
  return (
    <Reveal
      className={`mx-auto max-w-3xl ${
        align === "center" ? "text-center" : "text-left"
      }`}
    >
      <p className="marketing-eyebrow">
        {eyebrow}
      </p>

      <h2 className="marketing-section-title mt-3">
        {title}
      </h2>

      <p className="marketing-section-copy mt-4">
        {text}
      </p>
    </Reveal>
  );
}

export function CTAButtons({
  align = "left",
}: {
  align?: "left" | "center";
}) {
  return (
    <div
      className={`mt-8 flex flex-col gap-3 sm:flex-row ${
        align === "center" ? "sm:justify-center" : ""
      }`}
    >
      <PlanCtaLink
        plan="free"
        className="marketing-button marketing-button-primary min-h-13 px-7 py-3.5 text-base"
      >
        Start Free
      </PlanCtaLink>

      <Link
        href="/demo"
        className="marketing-button marketing-button-secondary min-h-13 px-7 py-3.5 text-base"
      >
        View Demo
      </Link>
    </div>
  );
}

export function DashboardPreview() {
  return (
    <div className="marketing-product-frame">
      <div className="marketing-product-browser">
        <span />
        <span />
        <span />
        <strong>SydIN Workspace</strong>
      </div>
      <div className="marketing-product-app">
        <aside className="marketing-product-rail">
          <SydINMark size="md" />
          {["dashboard", "box", "scan", "reports"].map((icon, index) => (
            <span
              key={icon}
              className={index === 0 ? "marketing-product-rail-active" : ""}
            >
              <UiIcon
                name={icon as "dashboard" | "box" | "scan" | "reports"}
                className="h-4 w-4"
              />
            </span>
          ))}
        </aside>

        <div className="marketing-product-main">
          <div className="marketing-product-command">
            <div className="min-w-0">
              <p>Inventory overview</p>
              <strong>North Studio</strong>
            </div>
            <span className="marketing-product-search">
              <UiIcon name="search" className="h-4 w-4" />
              Search inventory
            </span>
            <span className="marketing-product-add">
              <UiIcon name="plus" className="h-4 w-4" />
              Add item
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Items", "128"],
              ["Quantity", "1,246"],
              ["Low stock", "9"],
              ["Value", "$18.4K"],
            ].map(([label, value], index) => (
              <div key={label} className="marketing-product-stat">
                <span className={`marketing-product-dot marketing-product-dot-${index + 1}`} />
                <p className="mt-4 text-2xl font-bold text-slate-950">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="marketing-product-workspace">
            <div className="marketing-product-list">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-950">Visual inventory</p>
                  <p className="mt-1 text-xs text-slate-500">Photo-first item records</p>
                </div>
                <span className="text-xs font-semibold text-blue-600">Grid view</span>
              </div>
              <div className="marketing-product-card-grid">
                {[
                  ["Studio storage box", "BOX-014", "4 left"],
                  ["Ceramic planter", "RET-104", "7 left"],
                  ["Event tote", "EVT-220", "32 left"],
                ].map(([name, code, stock]) => (
                  <div key={code} className="marketing-product-card">
                    <span className="marketing-product-thumb" />
                    <strong>{name}</strong>
                    <small>{code}</small>
                    <span className="marketing-product-stock">{stock}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="marketing-product-side-panel">
              <div>
                <p>Stock health</p>
                <strong>93%</strong>
                <span>9 items need attention</span>
              </div>
              <div className="marketing-product-priority-list">
                {["Restock ceramic planter", "Scan incoming shipment", "Prepare pick list"].map(
                  (item) => (
                    <span key={item}>
                      <UiIcon name="check" className="h-3.5 w-3.5" />
                      {item}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MiniQrPreview() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="mx-auto grid h-36 w-36 grid-cols-5 gap-1 rounded-3xl bg-white p-4">
        {Array.from({ length: 25 }).map((_, index) => (
          <div
            key={index}
            className={`rounded-sm ${
              [0, 1, 2, 5, 10, 12, 14, 18, 20, 21, 22, 24].includes(index)
                ? "bg-[#02030a]"
                : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      <p className="mt-5 text-center text-sm font-bold text-slate-300">
        Public item page ready for phone scanning
      </p>
    </div>
  );
}

export function PricingCards({
  compact = false,
}: PricingCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {pricingPlans.map((plan, index) => (
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
                {plan.priceMonthly === null ? "Custom" : `$${plan.priceMonthly}`}
              </span>
              {plan.priceMonthly !== null && (
                <span className="pb-2 text-sm font-bold text-slate-500">
                  /month
                </span>
              )}
            </div>

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
  );
}

export function MarketingCTA() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <Reveal>
        <div className="marketing-cta mx-auto max-w-7xl overflow-hidden px-5 py-14 text-center sm:px-8 lg:px-12">
          <p className="marketing-eyebrow marketing-eyebrow-on-dark">
            Start with clarity
          </p>

          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Start managing inventory with more confidence.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Smart inventory, clear operations, and a workspace your team can learn quickly.
          </p>

          <CTAButtons align="center" />
        </div>
      </Reveal>
    </section>
  );
}

/**
 * Floating product artifacts for the hero.
 *
 * The reference page doesn't put its product shot in a frame under the
 * headline -- it scatters cropped UI fragments around the type so the text and
 * the product read as one composition. These are the SydIN equivalents: the
 * numbers a shop owner actually looks at, not decorative shapes.
 *
 * Desktop only. They're absolutely positioned against the hero and would
 * collide with the headline on a narrow screen, and mobile is its own design
 * pass (Phase 5b) rather than a squeezed version of this one -- so below the
 * lg breakpoint they don't render at all and the centred preview carries the
 * hero on its own.
 *
 * aria-hidden throughout: every number here is illustrative, and a screen
 * reader announcing invented stock figures between the headline and the CTA
 * would be actively misleading.
 */
export function HeroArtifacts() {
  return (
    <div className="marketing-hero-artifacts" aria-hidden="true">
      <div className="marketing-artifact marketing-artifact-stock">
        <p className="marketing-artifact-label">Low stock</p>
        <ul>
          {[
            ["Ceramic planter", "4 left"],
            ["Linen apron", "7 left"],
            ["Brass hooks", "2 left"],
          ].map(([name, count]) => (
            <li key={name}>
              <span>{name}</span>
              <strong>{count}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="marketing-artifact marketing-artifact-value">
        <p className="marketing-artifact-label">Inventory value</p>
        <strong className="marketing-artifact-metric">$18,420</strong>
        <span className="marketing-artifact-delta">
          <UiIcon name="arrow-up" className="h-3.5 w-3.5" />
          6.2% vs last month
        </span>
      </div>

      <div className="marketing-artifact marketing-artifact-scan">
        <span className="marketing-artifact-scan-icon">
          <UiIcon name="scan" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="marketing-artifact-label">Scanned</p>
          <strong>FP-0142</strong>
        </div>
        <span className="marketing-artifact-check">
          <UiIcon name="check" className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
