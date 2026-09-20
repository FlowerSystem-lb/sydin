import type { Metadata } from "next";
import UiIcon from "@/components/UiIcon";
import Link from "next/link";
import {
  DashboardPreview,
  MarketingCTA,
  MarketingPage,
  MiniQrPreview,
  SectionIntro,
} from "@/components/Marketing";
import Reveal from "@/components/Reveal";
import PlanCtaLink from "@/components/PlanCtaLink";


/* Every route shared one title until now, so a tab open on Pricing and
   a tab open on Terms looked identical. This is a public page: the
   title is what a shared link shows and what search results read. */
export const metadata: Metadata = {
  title: "Demo · SydIN",
  description:
    "See how SydIN tracks stock, prints QR labels and records what moved.",
};


const demoItems = [
  {
    name: "Event display stand",
    sku: "EVT-018",
    category: "Events",
    quantity: 14,
  },
  {
    name: "Ceramic planter",
    sku: "RET-104",
    category: "Retail",
    quantity: 7,
  },
  {
    name: "Tool case",
    sku: "OPS-032",
    category: "Operations",
    quantity: 28,
  },
];

export default function DemoPage() {
  return (
    <MarketingPage active="demo">
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
                Public demo
              </p>

              <h1 className="marketing-section-title mt-4">
                See how SydIN turns item records into a visual workflow.
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
                This sample demo shows inventory cards, QR workflow, and item detail previews without requiring login.
              </p>

              {/* Were hand-rolled dark-theme buttons: the primary was a white
                  fill with black text, which on the light page rendered as a
                  white button on white. Now the shared filled/ghost pill pair
                  like every other CTA on the site. */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PlanCtaLink
                  plan="free"
                  className="marketing-button marketing-button-primary min-h-13 px-7 py-3 text-base"
                >
                  Start Free
                </PlanCtaLink>

                <Link
                  href="/features"
                  className="marketing-button marketing-button-secondary min-h-13 px-7 py-3 text-base"
                >
                  View Features
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Sample inventory"
          title="A visual card system for real-world products."
          text="Cards combine product photos, SKU, category, stock quantity, and low-stock signals."
        />

        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-5 md:grid-cols-3">
          {demoItems.map((item, index) => (
            <Reveal key={item.sku} delay={index * 80}>
              <div className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055] shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                {/* The demo has no real photos; the honest stand-in is the
                    same "no photo" plate the app itself shows, not a pastel
                    gradient block. */}
                <div className="p-5">
                  <div className="flex h-52 items-center justify-center rounded-3xl border border-[var(--border-hairline)] bg-[#f4f4f5] text-[#a1a1aa]">
                    <UiIcon name="box" className="h-8 w-8" />
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black">
                        {item.name}
                      </h2>
                      <p className="mt-2 text-sm text-slate-400">
                        {item.sku} - {item.category}
                      </p>
                    </div>

                    <span className="rounded-lg border border-[var(--border-default)] bg-[#f7f7f8] px-3 py-1.5 text-sm font-semibold text-[#18181b]">
                      Qty {item.quantity}
                    </span>
                  </div>

                  {item.quantity <= 10 && (
                    <span className="mt-5 inline-flex rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
                      Low stock
                    </span>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <MiniQrPreview />
          </Reveal>

          <Reveal delay={120}>
            <div className="h-full rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
                QR workflow
              </p>

              <h2 className="marketing-section-title mt-3">
                Generate, download, scan, and open the item page.
              </h2>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {["Generate QR", "Download QR", "Scan with phone", "Open public page"].map((step) => (
                  <div
                    key={step}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-slate-300"
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Item detail preview"
          title="Everything important about an item in one place."
          text="A product page can hold the photo, stock, SKU, category, notes, QR link, and history timeline."
        />

        <Reveal>
          <div className="mx-auto mt-10 max-w-5xl rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[0.9fr_1.1fr]">
              <div className="p-5">
                <div className="flex h-72 items-center justify-center rounded-3xl border border-[var(--border-hairline)] bg-[#f4f4f5] text-[#a1a1aa]">
                  <UiIcon name="box" className="h-10 w-10" />
                </div>
              </div>

              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
                  Product record
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Event display stand
                </h2>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    ["SKU", "EVT-018"],
                    ["Category", "Events"],
                    ["Quantity", "14"],
                    ["History", "Tracked"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4"
                    >
                      <p className="text-xs font-bold text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 font-black text-white">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <MarketingCTA />
    </MarketingPage>
  );
}
