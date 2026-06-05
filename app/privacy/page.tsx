import { MarketingPage, SectionIntro } from "@/components/Marketing";
import Reveal from "@/components/Reveal";

const privacySections = [
  {
    title: "Account Data",
    text: "SydIn may store account information such as your email address, login identity, business settings, plan status, and workspace preferences so the service can provide a private inventory workspace.",
  },
  {
    title: "Inventory Data",
    text: "Inventory records may include product names, SKU values, categories, quantities, depot assignments, notes, QR/public item references, and item history. This data is used to operate SydIn and show your inventory accurately.",
  },
  {
    title: "Uploaded Images",
    text: "Product images and business logos uploaded through SydIn are stored so the application can display visual inventory records, public item pages, and workspace branding.",
  },
  {
    title: "Payment Requests",
    text: "When you submit a plan request, SydIn may collect the business name, contact details, requested plan, preferred payment method, and message details needed to review and activate subscriptions manually.",
  },
  {
    title: "How Data Is Used",
    text: "Data is used to operate SydIn, maintain inventory features, support account access, provide customer support, process early access plan requests, improve product reliability, and protect the service.",
  },
];

export default function PrivacyPage() {
  return (
    <MarketingPage active="none">
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Privacy"
          title="SydIn Privacy Policy"
          text="A simple overview of how SydIn handles data while the product is in early access."
        />

        <Reveal>
          <div className="mx-auto mt-8 max-w-4xl rounded-[28px] border border-indigo-300/20 bg-indigo-500/10 px-5 py-4 text-center text-sm font-semibold text-indigo-100">
            This is an early access privacy policy and may be updated.
          </div>
        </Reveal>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5">
          {privacySections.map((section, index) => (
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
                For privacy questions, contact SydIn at support@sydin.app.
              </p>
            </article>
          </Reveal>
        </div>
      </section>
    </MarketingPage>
  );
}
