import Link from "next/link";
import {
  CTAButtons,
  DashboardPreview,
  MarketingCTA,
  MarketingPage,
  MiniQrPreview,
  PricingCards,
  SectionIntro,
} from "@/components/Marketing";
import Reveal from "@/components/Reveal";

const trustBadges = [
  "Photo inventory",
  "QR codes",
  "Stock history",
  "Mobile ready",
  "Private workspace",
];

const storySections = [
  {
    eyebrow: "Organize",
    title: "Organize products with photos, SKU, category, and notes.",
    bullets: [
      "Add products in seconds",
      "Upload product images",
      "Search by name, SKU, or category",
    ],
    visual: "photo",
  },
  {
    eyebrow: "Manage",
    title: "Track stock changes and item history.",
    bullets: [
      "View stock quantity",
      "See created and edited history",
      "Detect low-stock items",
    ],
    visual: "history",
  },
  {
    eyebrow: "QR",
    title: "Give every item a QR page.",
    bullets: [
      "Generate QR code",
      "Download QR",
      "Public item page for scanning",
      "Works on phone camera",
    ],
    visual: "qr",
  },
  {
    eyebrow: "Reporting ready",
    title: "Ready for reports, exports, and audits.",
    bullets: [
      "Item history foundation",
      "Export-ready structure",
      "Clean inventory records",
    ],
    visual: "records",
  },
];

const workflow = [
  "Add product",
  "Upload photo",
  "Generate QR",
  "Track stock history",
  "Share or scan item page",
];

const customers = [
  "Flower shops",
  "Event businesses",
  "Small warehouses",
  "Retail shops",
  "Local sellers",
  "Maintenance/tools teams",
];

function StoryVisual({
  type,
}: {
  type: string;
}) {
  if (type === "qr") {
    return <MiniQrPreview />;
  }

  if (type === "history") {
    return (
      <div className="rounded-[30px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        {["Created item", "Edited quantity", "Updated photo"].map((event, index) => (
          <div
            key={event}
            className="flex items-center gap-4 border-b border-white/10 py-4 last:border-b-0"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-500/15 text-sm font-black text-indigo-100">
              {index + 1}
            </div>

            <div>
              <p className="font-bold text-white">
                {event}
              </p>
              <p className="text-sm text-slate-500">
                Quantity tracked with timestamp
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "records") {
    return (
      <div className="rounded-[30px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-500">
          <span>Item</span>
          <span>Stock</span>
          <span>Status</span>
        </div>

        {[
          ["Glass vase", "31", "Ready"],
          ["Tool kit", "8", "Low"],
          ["Storage box", "42", "Ready"],
        ].map(([name, stock, status]) => (
          <div
            key={name}
            className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm"
          >
            <span className="font-bold text-white">{name}</span>
            <span className="text-indigo-100">{stock}</span>
            <span className="text-slate-300">{status}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="rounded-3xl bg-[#f4f0e8] p-5">
        <div className="h-52 rounded-3xl bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-emerald-100" />
      </div>

      <div className="mt-5">
        <p className="text-xl font-black">
          Product photo card
        </p>
        <p className="mt-2 text-sm text-slate-400">
          SKU, category, notes, and stock in one visual record.
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <MarketingPage active="home">
      <section className="relative px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <div>
              <p className="inline-flex rounded-full border border-indigo-300/25 bg-indigo-500/15 px-4 py-2 text-sm font-bold text-indigo-100">
                Inventory management for small businesses - with photos, QR codes, and history.
              </p>

              <h1 className="mt-6 text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                Simple inventory software built for{" "}
                <span className="bg-gradient-to-r from-indigo-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">
                  visual
                </span>{" "}
                businesses.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
                Track stock, upload product photos, generate QR item pages, and keep a history of every movement.
              </p>

              <CTAButtons />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-3">
            {trustBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-bold text-slate-300 backdrop-blur-xl"
              >
                {badge}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Product story"
          title="A cleaner way to see, scan, and trust inventory."
          text="SydIn combines the speed of a lightweight inventory tool with the visual context small teams need every day."
        />

        <div className="mx-auto mt-12 flex w-full max-w-7xl flex-col gap-10">
          {storySections.map((section, index) => (
            <Reveal key={section.title} delay={index * 80}>
              <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
                <div className={`rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8 ${
                  index % 2 === 1 ? "lg:order-2" : ""
                }`}>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
                    {section.eyebrow}
                  </p>

                  <h3 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                    {section.title}
                  </h3>

                  <ul className="mt-6 space-y-3">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-3 text-slate-300"
                      >
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-300" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <StoryVisual type={section.visual} />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="How it works"
          title="Five practical steps from item setup to scan-ready records."
          text="The workflow is built for busy operators who need inventory to stay simple and visible."
        />

        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {workflow.map((step, index) => (
            <Reveal key={step} delay={index * 70}>
              <div className="h-full rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sm font-black text-black">
                  {index + 1}
                </div>

                <p className="mt-5 text-xl font-black">
                  {step}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Who it is for"
          title="Built for small businesses that need clarity."
          text="SydIn fits teams that manage physical items, changing stock, and visual product details."
        />

        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer, index) => (
            <Reveal key={customer} delay={index * 60}>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
                <div className="mb-5 h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-300 to-fuchsia-500" />
                <h3 className="text-2xl font-black">
                  {customer}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Keep item records visual, searchable, and ready for the next scan.
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Pricing preview"
          title="Simple plans for early SydIn users."
          text="Payments are coming soon. Early users can request manual activation."
        />

        <div className="mx-auto mt-10 max-w-7xl">
          <PricingCards compact />
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 rounded-[34px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl lg:grid-cols-[0.8fr_1.2fr] lg:p-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
                About SydIn
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Why SydIn exists
              </h2>
            </div>

            <p className="text-base leading-8 text-slate-400 sm:text-lg">
              SydIn was created for small businesses that need a faster, more visual way to manage inventory without complicated enterprise software. The goal is simple: make inventory easy to see, easy to scan, and easy to trust.
            </p>
          </div>
        </Reveal>
      </section>

      <MarketingCTA />

      <section className="px-4 pb-12 text-center sm:px-6 lg:px-8">
        <Link
          href="/features"
          className="text-sm font-bold text-indigo-200 transition hover:text-white"
        >
          Explore all SydIn features
        </Link>
      </section>
    </MarketingPage>
  );
}
