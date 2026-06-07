import {
  MarketingCTA,
  MarketingPage,
  pricingPlans,
  PricingCards,
  SectionIntro,
} from "@/components/Marketing";
import Reveal from "@/components/Reveal";

const comparisonRows = [
  ["Items", "50", "250", "1,000", "Custom"],
  ["Product photos", "Included", "Included", "Included", "Included"],
  ["QR public item pages", "Included", "Included", "Included", "Included"],
  ["CSV export", "Included", "Included", "Included", "Included"],
  ["Stock movements", "Basic", "Basic", "Basic", "Custom"],
  ["Depots", "1", "3", "10", "Custom"],
  ["Search and filters", "Included", "Included", "Included", "Included"],
  ["Business name", "Included", "Included", "Included", "Included"],
  ["Custom business logo", "Not included", "Included", "Included", "Included"],
  ["Custom low-stock threshold", "Not included", "Included", "Included", "Included"],
  ["Scanner", "Not included", "Included", "Included", "Included"],
  ["CSV/Excel import", "Not included", "Included", "Included", "Included"],
  ["Excel export", "Not included", "Included", "Included", "Included"],
  ["PDF export", "Not included", "Basic", "Basic", "Advanced later"],
  ["Reports and analytics", "Not included", "Not included", "Later", "Advanced later"],
  ["Pick lists", "Not included", "Not included", "Later", "Later"],
  ["Support", "Beta support", "Beta support", "Priority manual support", "Advanced later"],
  ["Teams and roles", "Not included", "Not included", "Not included", "Later"],
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
    answer: "Payments are handled manually during early access. After a request is reviewed, the SydIN team will contact you about activation and payment.",
  },
  {
    question: "Can I upgrade later?",
    answer: "Yes. Plan changes never delete inventory data. Your records remain available while your plan access and item allowance change.",
  },
  {
    question: "Can Free users export their data?",
    answer: "Yes. Free users can always access their inventory and export it as CSV. SydIN does not use ads or hold basic data export behind a paid plan.",
  },
];

export default function PricingPage() {
  return (
    <MarketingPage active="pricing">
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Pricing"
          title="Clear plans for inventory that grows with you."
          text="Start with a useful free workspace, then add more capacity and operational tools when your business needs them."
        />

        <div className="mx-auto mt-10 max-w-7xl">
          <PricingCards />

          <Reveal>
            <div className="mx-auto mt-6 max-w-3xl rounded-3xl border border-indigo-300/20 bg-indigo-500/10 px-5 py-5 text-center shadow-[0_20px_70px_rgba(30,64,175,0.16)]">
              <p className="text-sm font-bold text-indigo-100">
                Payments are handled manually during early access.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                SydIN is a private beta with no ads. Request Standard or Pro and the team will contact you to complete activation.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-5xl rounded-[30px] border border-white/10 bg-white/[0.045] p-6 text-center shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-7">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
              Private beta activation
            </p>

            <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
              Human-reviewed plans, without billing surprises.
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
              {[
                ["No ads", "Your workspace stays private and focused."],
                ["Safe plan changes", "Inventory data is never deleted when plans change."],
                ["CSV access", "Free users can always access and export their inventory."],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <p className="font-black text-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Compare"
          title="Compare capacity and workflow tools."
          text="Plan definitions are transparent during beta. Features marked later are roadmap items and are not presented as available today."
        />

        <Reveal>
          <div className="mx-auto mt-10 hidden max-w-7xl overflow-x-auto rounded-[30px] border border-white/10 bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:block">
            <div className="grid min-w-[980px] grid-cols-5 border-b border-white/10 bg-white/[0.04]">
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
                  className="grid min-w-[980px] grid-cols-5 border-b border-white/10 last:border-b-0"
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

          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 md:hidden">
            {comparisonRows.map(([feature, ...values]) => (
              <article
                key={feature}
                className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl"
              >
                <h3 className="text-base font-black text-white">{feature}</h3>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {pricingPlans.map((plan, index) => (
                    <div
                      key={plan.id}
                      className={`rounded-2xl border p-3 ${
                        plan.featured
                          ? "border-indigo-300/25 bg-indigo-500/10"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        {plan.name}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-200">
                        {values[index]}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
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
