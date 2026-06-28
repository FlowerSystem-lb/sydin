import { MarketingPage, SectionIntro } from "@/components/Marketing";
import Reveal from "@/components/Reveal";

const termsSections = [
  {
    title: "Use of SydIN",
    text: "SydIN provides inventory software for businesses that need to manage product records, quantities, images, depots, QR item pages, exports, and related workspace settings.",
  },
  {
    title: "User Responsibility",
    text: "Users are responsible for the accuracy, legality, and maintenance of the inventory data they enter into SydIN, including product details, uploaded images, notes, quantities, depot assignments, and public item page content.",
  },
  {
    title: "Early Access Status",
    text: "SydIN is currently an early access product. Features may be improved, adjusted, added, or removed as the service develops and customer needs become clearer.",
  },
  {
    title: "Subscriptions and Manual Activation",
    text: "Some plans may require manual review or activation. Early access payments and subscription changes may be handled manually before fully automated billing is available.",
  },
  {
    title: "Service Changes",
    text: "SydIN may change over time, including interface updates, plan changes, feature availability, limits, reports, exports, and operational workflows. The service may also require maintenance or temporary interruptions.",
  },
];

export default function TermsPage() {
  return (
    <MarketingPage active="none">
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Terms"
          title="SydIN Terms of Use"
          text="A plain-language early access overview for using SydIN."
        />

        <Reveal>
          <div className="mx-auto mt-8 max-w-4xl rounded-[28px] border border-indigo-300/20 bg-indigo-500/10 px-5 py-4 text-center text-sm font-semibold text-indigo-100">
            This is an early access terms page and may be updated.
          </div>
        </Reveal>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5">
          {termsSections.map((section, index) => (
            <Reveal key={section.title} delay={index * 70}>
              <article className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-8">
                <h2 className="text-2xl font-black text-white">
                  {section.title}
                </h2>

                <p className="mt-4 text-base leading-8 text-slate-400">
                  {section.text}
                </p>
              </article>
            </Reveal>
          ))}

          <Reveal>
            <article className="rounded-[30px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-8">
              <h2 className="text-2xl font-black text-white">
                Contact
              </h2>

              <p className="mt-4 text-base leading-8 text-slate-400">
                For terms or account questions, contact SydIN at support@sydin.app.
              </p>
            </article>
          </Reveal>
        </div>
      </section>
    </MarketingPage>
  );
}
