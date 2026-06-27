import Link from "next/link";
import {
  CTAButtons,
  DashboardPreview,
  MarketingCTA,
  MarketingPage,
  PricingCards,
  SectionIntro,
} from "@/components/Marketing";
import Reveal from "@/components/Reveal";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

const highlights = [
  "Photos and item records",
  "QR and barcode workflows",
  "Stock history",
  "Reports and Pick Lists",
];

const coreFeatures: Array<{
  title: string;
  text: string;
  icon: UiIconName;
}> = [
  {
    title: "See every item clearly",
    text: "Keep photos, codes, categories, suppliers, stock, and notes together in one dependable record.",
    icon: "box",
  },
  {
    title: "Know what needs attention",
    text: "Review low-stock priorities, inventory value, and recent activity without searching through spreadsheets.",
    icon: "reports",
  },
  {
    title: "Move work forward",
    text: "Scan items, record stock changes, and prepare Pick Lists from the same responsive workspace.",
    icon: "scan",
  },
];

const workflow = [
  ["01", "Create an item", "Add the product details your team actually uses."],
  ["02", "Track stock", "Record quantities and keep a dependable movement history."],
  ["03", "Scan and share", "Use item QR pages and supported barcode workflows."],
  ["04", "Act on insights", "Review reports and prepare work with Pick Lists."],
];

export default function Home() {
  return (
    <MarketingPage active="home">
      <section className="marketing-hero px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <Reveal className="mx-auto max-w-4xl text-center">
            <p className="marketing-hero-kicker">
              Smart inventory for growing businesses
            </p>

            <h1 className="marketing-hero-title mt-6">
              Inventory that stays{" "}
              <span className="marketing-gradient-text">simple.</span>
            </h1>

            <p className="marketing-hero-copy mx-auto mt-6 max-w-2xl">
              SydIN gives small teams one clear place to organize items, track
              stock, scan codes, prepare Pick Lists, and understand what needs
              attention next.
            </p>

            <CTAButtons align="center" />
          </Reveal>

          <Reveal delay={120} className="mx-auto mt-8 max-w-6xl sm:mt-10">
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-7 sm:px-6 lg:px-8">
        <Reveal>
          <div className="marketing-trust-strip mx-auto max-w-6xl">
            {highlights.map((highlight) => (
              <span key={highlight}>
                <UiIcon name="check" className="h-4 w-4" />
                {highlight}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <SectionIntro
          eyebrow="Made for daily operations"
          title="The essentials are easy to find and easy to use."
          text="SydIN keeps the interface calm so your inventory, not the software, stays at the center of the work."
        />

        <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-5 md:grid-cols-3">
          {coreFeatures.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 70}>
              <article className="marketing-feature-card">
                <span className="marketing-feature-icon">
                  <UiIcon name={feature.icon} className="h-6 w-6" />
                </span>
                <h2>{feature.title}</h2>
                <p>{feature.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="marketing-soft-section px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <Reveal>
            <div>
              <p className="marketing-eyebrow">A clear workflow</p>
              <h2 className="marketing-section-title mt-3">
                From first item to reliable operations.
              </h2>
              <p className="marketing-section-copy mt-4">
                Start small, keep your records clean, and add operational tools
                as the business grows.
              </p>
              <Link
                href="/features"
                className="marketing-inline-link mt-7"
              >
                Explore all features
                <UiIcon name="chevron-right" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {workflow.map(([number, title, text], index) => (
              <Reveal key={number} delay={index * 60}>
                <article className="marketing-workflow-card">
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Straightforward plans"
          title="Start free, then add capacity when it matters."
          text="Every plan keeps the same clear workspace. Higher plans add capacity and operational tools, not clutter."
        />
        <div className="mx-auto mt-12 max-w-7xl">
          <PricingCards compact />
        </div>
      </section>

      <MarketingCTA />
    </MarketingPage>
  );
}
