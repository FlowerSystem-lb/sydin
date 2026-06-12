import {
  CTAButtons,
  DashboardPreview,
  featureCards,
  MarketingCTA,
  MarketingPage,
  MiniQrPreview,
  SectionIntro,
} from "@/components/Marketing";
import Reveal from "@/components/Reveal";

const operationalFeatures = [
  "CSV and Excel inventory import",
  "Advanced reports and exports",
  "Pick Lists for order preparation",
];

export default function FeaturesPage() {
  return (
    <MarketingPage active="features">
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
                Features
              </p>

              <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl">
                Inventory tools built around real product visibility.
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
                SydIn helps shops, florists, warehouses, and local businesses track products, stock, photos, and QR item pages from one simple workspace.
              </p>

              <CTAButtons />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Core workflow"
          title="Everything a small team needs to manage visual inventory."
          text="The MVP focuses on the highest-value inventory work: product records, photos, QR access, history, and low-stock clarity."
        />

        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 70}>
              <div className="h-full rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
                <div className="mb-5 h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-300 via-violet-500 to-fuchsia-500" />

                <h2 className="text-2xl font-black">
                  {feature.title}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {feature.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
                QR item pages
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Every item can become scan-ready.
              </h2>

              <p className="mt-4 text-base leading-7 text-slate-400">
                Generate and download a QR code that opens a public item page. It is a practical bridge between your shelf, warehouse, phone camera, and inventory workspace.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <MiniQrPreview />
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Built forward"
          title="Connected tools for daily inventory operations."
          text="Import records, scan codes, review reports, and prepare Pick Lists without leaving the same inventory workspace."
        />

        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-3">
          {operationalFeatures.map((feature, index) => (
            <Reveal key={feature} delay={index * 80}>
              <div className="rounded-[28px] border border-indigo-300/20 bg-indigo-500/10 p-6 text-center shadow-[0_24px_90px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
                <p className="text-xl font-black">
                  {feature}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <MarketingCTA />
    </MarketingPage>
  );
}
