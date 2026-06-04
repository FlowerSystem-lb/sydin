import {
  MarketingCTA,
  MarketingPage,
  pricingPlans,
  PricingCards,
  SectionIntro,
} from "@/components/Marketing";
import Reveal from "@/components/Reveal";

const comparisonRows = [
  ["Items", "50", "200", "1000"],
  ["QR item pages", "Included", "Included", "Included"],
  ["Item history", "Included", "Included", "Included"],
  ["Photo inventory", "Included", "More storage", "More storage"],
  ["Exports", "Coming", "Coming", "Advanced coming"],
  ["Team features", "Later", "Later", "Planned"],
];

const faqs = [
  {
    question: "Can I start free?",
    answer: "Yes. The Free plan is designed for early users who want to manage up to 50 items before choosing a paid plan.",
  },
  {
    question: "Do QR codes work on mobile?",
    answer: "Yes. QR codes open public item pages that are designed to be simple to scan and view from a phone camera.",
  },
  {
    question: "Can I upload photos?",
    answer: "Yes. SydIn supports product photo uploads so inventory is easier to recognize visually.",
  },
  {
    question: "Are payments active now?",
    answer: "Early access payments are handled manually through WhishMoney, OMT, or crypto. Card payments are coming soon.",
  },
  {
    question: "Can I upgrade later?",
    answer: "Yes. SydIn is structured around simple plans so businesses can start small and upgrade as their inventory grows.",
  },
];

export default function PricingPage() {
  return (
    <MarketingPage active="pricing">
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Pricing"
          title="Start free, then grow when your inventory grows."
          text="Choose a practical early plan for visual inventory, QR item pages, and item history."
        />

        <div className="mx-auto mt-10 max-w-7xl">
          <PricingCards />

          <Reveal>
            <p className="mx-auto mt-6 max-w-2xl rounded-2xl border border-indigo-300/20 bg-indigo-500/10 px-5 py-4 text-center text-sm font-semibold text-indigo-100">
              Early access payments are handled manually through WhishMoney, OMT, or crypto. Card payments are coming soon.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-5xl rounded-[30px] border border-white/10 bg-white/[0.045] p-6 text-center shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-7">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
              Payment methods
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {["WhishMoney", "OMT", "Crypto", "Card payments coming soon"].map((method) => (
                <span
                  key={method}
                  className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-bold text-slate-300"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Compare"
          title="Plan details at a glance."
          text="The MVP plans are intentionally simple, with room for reports, exports, and team features as SydIn grows."
        />

        <Reveal>
          <div className="mx-auto mt-10 max-w-7xl overflow-x-auto rounded-[30px] border border-white/10 bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
            <div className="grid min-w-[720px] grid-cols-4 border-b border-white/10 bg-white/[0.04]">
              <div className="p-4 text-sm font-black text-slate-400">
                Feature
              </div>
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className="p-4 text-sm font-black text-white"
                >
                  {plan.name}
                </div>
              ))}
            </div>

            <div>
              {comparisonRows.map((row) => (
                <div
                  key={row[0]}
                  className="grid min-w-[720px] grid-cols-4 border-b border-white/10 last:border-b-0"
                >
                  {row.map((cell, index) => (
                    <div
                      key={`${row[0]}-${index}`}
                      className={`p-4 text-sm ${
                        index === 0
                          ? "font-bold text-white"
                          : "text-slate-300"
                      }`}
                    >
                      {cell}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="FAQ"
          title="Common pricing questions."
          text="A few simple answers for early SydIn customers."
        />

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4">
          {faqs.map((faq, index) => (
            <Reveal key={faq.question} delay={index * 70}>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
                <h2 className="text-xl font-black">
                  {faq.question}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {faq.answer}
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
