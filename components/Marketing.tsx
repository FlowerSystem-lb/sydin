import Link from "next/link";
import Reveal from "@/components/Reveal";

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

export const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    cadence: "/month",
    description: "Start with a clean inventory system for a small catalog.",
    features: [
      "Up to 50 items",
      "Basic inventory",
      "QR pages",
      "Item history",
    ],
    ctaLabel: "Start Free",
    ctaHref: "/signup",
  },
  {
    name: "Standard",
    price: "$20",
    cadence: "/month",
    description: "For growing teams that need more room and priority access.",
    featured: true,
    features: [
      "Up to 200 items",
      "More storage",
      "Exports coming",
      "Priority feature access",
    ],
    ctaLabel: "Request Standard",
    ctaHref: "/request-plan?plan=Standard",
  },
  {
    name: "Pro",
    price: "$25",
    cadence: "/month",
    description: "Built for larger operations preparing for advanced workflows.",
    features: [
      "Up to 1000 items",
      "Advanced reports coming",
      "Multi-depot ready",
      "Team features later",
    ],
    ctaLabel: "Request Pro",
    ctaHref: "/request-plan?plan=Pro",
  },
];

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
    text: "Use SydIn comfortably on phone, tablet, and desktop when work happens away from the desk.",
  },
  {
    title: "Reports foundation",
    text: "Clean records and item history prepare the product for exports, reports, and audits as you grow.",
  },
];

export function MarketingPage({
  active = "home",
  children,
}: MarketingPageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02030a] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_8%,_rgba(99,102,241,0.26),_transparent_32%),radial-gradient(circle_at_84%_12%,_rgba(168,85,247,0.22),_transparent_30%),linear-gradient(135deg,_#02030a_0%,_#050713_46%,_#02030a_100%)]" />
      <div className="pointer-events-none fixed left-[-120px] top-32 -z-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl sydin-float-slow" />
      <div className="pointer-events-none fixed bottom-16 right-[-100px] -z-10 h-80 w-80 rounded-full bg-fuchsia-500/14 blur-3xl sydin-float-slower" />

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
      className="flex min-w-0 items-center gap-3"
      aria-label="SydIn home"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-300 via-violet-500 to-fuchsia-500 text-base font-black text-white shadow-[0_18px_60px_rgba(124,58,237,0.36)]">
        S
      </div>

      <div className="min-w-0">
        <p className="text-xl font-black tracking-tight">
          SydIn
        </p>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Visual inventory
        </p>
      </div>
    </Link>
  );
}

export function MarketingHeader({
  active,
}: {
  active: MarketingSection;
}) {
  return (
    <header className="relative z-20 border-b border-white/10 bg-[#02030a]/78 backdrop-blur-2xl">
      <div className="border-b border-white/10 bg-white/[0.035] px-4 py-2 text-center text-xs font-semibold text-indigo-100 sm:text-sm">
        Launch offer: Start free with up to 50 items
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <MarketingLogo />

          <nav className="hidden items-center gap-2 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  active === link.key
                    ? "bg-white text-black"
                    : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1] sm:inline-flex"
            >
              Sign in
            </Link>

            <Link
              href="/signup"
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200 sm:px-5"
            >
              Start Free
            </Link>
          </div>
        </div>

        <nav className="grid grid-cols-5 gap-2 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`min-h-11 rounded-2xl px-2 py-3 text-center text-xs font-bold transition ${
                active === link.key
                  ? "bg-white text-black"
                  : "bg-white/[0.06] text-slate-300"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/login"
            className="min-h-11 rounded-2xl bg-white/[0.06] px-2 py-3 text-center text-xs font-bold text-slate-300"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/20 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <MarketingLogo />

        <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-400">
          <Link href="/features" className="hover:text-white">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-white">
            Pricing
          </Link>
          <Link href="/demo" className="hover:text-white">
            Demo
          </Link>
          <Link href="/contact" className="hover:text-white">
            Contact
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
          <Link href="/login" className="hover:text-white">
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
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>

      <p className="mt-4 text-base leading-7 text-slate-400 sm:text-lg">
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
      <Link
        href="/signup"
        className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-7 py-4 text-base font-black text-black shadow-[0_22px_70px_rgba(255,255,255,0.14)] transition hover:bg-slate-200"
      >
        Start Free
      </Link>

      <Link
        href="/demo"
        className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-7 py-4 text-base font-black text-white transition hover:border-white/20 hover:bg-white/[0.1]"
      >
        View Demo
      </Link>
    </div>
  );
}

export function DashboardPreview() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.055] p-4 shadow-[0_34px_130px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5">
      <div className="rounded-[26px] border border-white/10 bg-[#060918]/90 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">
              SydIn workspace
            </p>
            <p className="mt-1 text-xl font-black">
              Inventory overview
            </p>
          </div>

          <div className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-black">
            Add Item
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["Total Items", "128"],
            ["Low Stock", "9"],
            ["QR Item Page", "Ready"],
            ["History", "Tracked"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
            >
              <p className="text-xs font-semibold text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-black text-white">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-3xl border border-white/10 bg-black/25 p-4">
          <div className="grid grid-cols-[96px_1fr] gap-4">
            <div className="flex h-28 items-center justify-center rounded-2xl bg-[#f4f0e8] p-3">
              <div className="h-full w-full rounded-xl bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-emerald-100" />
            </div>

            <div className="min-w-0">
              <p className="text-lg font-black">
                Studio storage box
              </p>
              <p className="mt-1 text-sm text-slate-400">
                SKU BOX-014 - Category Supplies
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-indigo-300/25 bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-100">
                  Qty 42
                </span>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-100">
                  QR ready
                </span>
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
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {pricingPlans.map((plan, index) => (
        <Reveal key={plan.name} delay={index * 80}>
          <div
            className={`flex h-full flex-col rounded-[30px] border p-6 shadow-[0_28px_100px_rgba(0,0,0,0.3)] backdrop-blur-2xl ${
              plan.featured
                ? "border-indigo-300/35 bg-indigo-500/15"
                : "border-white/10 bg-white/[0.045]"
            }`}
          >
            {plan.featured && (
              <span className="mb-4 self-start rounded-full border border-indigo-300/30 bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-indigo-100">
                Popular
              </span>
            )}

            <h3 className="text-2xl font-black">
              {plan.name}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              {plan.description}
            </p>

            <div className="mt-6 flex items-end gap-1">
              <span className="text-5xl font-black">
                {plan.price}
              </span>
              <span className="pb-2 text-sm font-bold text-slate-500">
                {plan.cadence}
              </span>
            </div>

            <ul className={`mt-6 space-y-3 ${compact ? "text-sm" : "text-base"}`}>
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex gap-3 text-slate-300"
                >
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-300" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={plan.ctaHref}
              className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-black transition ${
                plan.featured
                  ? "bg-white text-black hover:bg-slate-200"
                  : "border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]"
              }`}
            >
              {plan.ctaLabel}
            </Link>
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
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.24),_transparent_34%),rgba(255,255,255,0.055)] px-5 py-14 text-center shadow-[0_34px_130px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:px-8 lg:px-12">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
            Start with clarity
          </p>

          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            Start managing inventory with more confidence.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Inventory management for small businesses - with photos, QR codes, and history.
          </p>

          <CTAButtons align="center" />
        </div>
      </Reveal>
    </section>
  );
}
