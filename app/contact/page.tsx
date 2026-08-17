import { MarketingPage, SectionIntro } from "@/components/Marketing";
import Reveal from "@/components/Reveal";
import PlanCtaLink from "@/components/PlanCtaLink";
import {
  buildSupportMailtoUrl,
  buildSupportWhatsAppUrl,
  SYDIN_SUPPORT_EMAIL,
  SYDIN_WHATSAPP_DISPLAY,
} from "@/app/lib/support";

const contactMethods = [
  {
    label: "Support email",
    value: SYDIN_SUPPORT_EMAIL,
    text: "Use this address for product questions, account help, plan requests, and early access support.",
    href: buildSupportMailtoUrl(),
    action: "Email SydIN",
  },
  {
    label: "WhatsApp / direct contact",
    value: SYDIN_WHATSAPP_DISPLAY,
    text: "Send a WhatsApp message for account or product help during SydIN early access.",
    href: buildSupportWhatsAppUrl(),
    action: "Message on WhatsApp",
  },
];

export default function ContactPage() {
  return (
    <MarketingPage active="contact">
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Contact"
          title="Talk to the SydIN team."
          text="Get help with early access, plan activation, inventory workflows, or questions about using SydIN for your business."
        />

        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-2">
          {contactMethods.map((method, index) => (
            <Reveal key={method.label} delay={index * 80}>
              <div className="h-full rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-300">
                  {method.label}
                </p>

                <h2 className="mt-3 break-words text-3xl font-black tracking-tight text-white">
                  {method.value}
                </h2>

                <p className="mt-4 text-base leading-7 text-slate-400">
                  {method.text}
                </p>

                <a
                  href={method.href}
                  target={
                    method.label.startsWith("WhatsApp") ? "_blank" : undefined
                  }
                  rel={
                    method.label.startsWith("WhatsApp")
                      ? "noreferrer"
                      : undefined
                  }
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-500/15 px-5 py-3 text-sm font-black text-indigo-100 transition hover:border-indigo-300/40 hover:bg-indigo-500/25"
                >
                  {method.action}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-6xl rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.24),_transparent_34%),rgba(255,255,255,0.055)] p-6 shadow-[0_34px_130px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-8 lg:p-10">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
                  Ready when you are
                </p>

                {/* `text-white` dropped, not converted: the section reverted to
                    a light background in an earlier pass, so a later rule was
                    already forcing this dark (computed rgb(8,21,43)). Keeping
                    the class would just misdescribe what renders. */}
                <h2 className="marketing-section-title mt-3">
                  Start free or request a plan for a larger inventory.
                </h2>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
                  SydIN is in early access, with manual plan activation available for growing teams.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <PlanCtaLink
                  plan="standard"
                  className="marketing-button marketing-button-primary min-h-13 px-7 py-3 text-base"
                >
                  Request Standard
                </PlanCtaLink>

                <PlanCtaLink
                  plan="free"
                  className="marketing-button marketing-button-secondary min-h-13 px-7 py-3 text-base"
                >
                  Start Free
                </PlanCtaLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </MarketingPage>
  );
}
