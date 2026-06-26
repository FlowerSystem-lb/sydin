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
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Inventory overview
              </p>
              <p className="mt-1 text-lg font-bold text-slate-950">
                Good morning, North Studio
              </p>
            </div>
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

          <div className="marketing-product-list mt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-950">Restock priorities</p>
                <p className="mt-1 text-xs text-slate-500">Items at or below minimum stock</p>
              </div>
              <span className="text-xs font-semibold text-blue-600">View report</span>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                ["Studio storage box", "BOX-014", "4 left"],
                ["Ceramic planter", "RET-104", "7 left"],
              ].map(([name, code, stock]) => (
                <div key={code} className="marketing-product-row">
                  <span className="marketing-product-thumb" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{name}</span>
                    <span className="block text-xs text-slate-500">{code}</span>
                  </span>
                  <span className="marketing-product-stock">{stock}</span>
                </div>
              ))}
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
