"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MarketingPage,
  SectionIntro,
} from "@/components/Marketing";
import Reveal from "@/components/Reveal";
import { supabase } from "@/app/lib/supabase";

type PlanName = "Standard" | "Pro";
type PaymentMethod = "WhishMoney" | "OMT" | "Crypto";
type CopyTarget = "whish" | "omt" | "crypto";

const planOptions: PlanName[] = ["Standard", "Pro"];
const paymentMethods: PaymentMethod[] = ["WhishMoney", "OMT", "Crypto"];
const paymentMethodLabels: Record<PaymentMethod, string> = {
  WhishMoney: "Whish Money",
  OMT: "OMT",
  Crypto: "USDT / Crypto",
};
const RECEIVER_NAME = "SydIN Tech";
const WHISH_NUMBER = "96176075247";
const OMT_NUMBER = "96176075247";
const USDT_NETWORK = "USDT TRC20";
const USDT_ADDRESS = "TYwWogiC9f2aHcidDQcyspTPj9S5TDZaDs";
const WHATSAPP_NUMBER = "96176075247";

function PaymentIcon({
  method,
}: {
  method: "transfer" | "crypto" | "card";
}) {
  if (method === "crypto") {
    return (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v20M7.5 6.5h6.25a3.25 3.25 0 0 1 0 6.5H9.5h4.75a3.25 3.25 0 0 1 0 6.5H7.5" />
      </svg>
    );
  }

  if (method === "card") {
    return (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 10h18M7 15h3" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8h16M6 4h12l2 4H4l2-4Z" />
      <path d="M6 8v10M10 8v10M14 8v10M18 8v10M4 20h16" />
    </svg>
  );
}

function RequestPlanContent() {
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanName>(
    searchParams.get("plan")?.toLowerCase() === "pro" ? "Pro" : "Standard"
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("WhishMoney");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const [copyError, setCopyError] = useState("");
  const requestSource = searchParams.get("source")?.trim() || "";

  const whatsappMessage = [
    `Hello SydIN, I am interested in the ${selectedPlan} plan.`,
    email.trim() ? `My email is ${email.trim()}.` : "",
    success ? "I have submitted my early access plan request." : "",
  ]
    .filter(Boolean)
    .join(" ");
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  const copyPaymentDetails = async (
    target: CopyTarget,
    value: string
  ) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
      setCopyError("");
      window.setTimeout(() => {
        setCopiedTarget((current) => (current === target ? null : current));
      }, 2200);
    } catch {
      setCopiedTarget(null);
      setCopyError("Copy failed. Select the payment detail and copy it manually.");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (submitting) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Full name is required.");
      return;
    }

    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const { error: insertError } = await supabase
        .from("plan_requests")
        .insert([
          {
            full_name: trimmedName,
            business_name: businessName.trim() || null,
            email: trimmedEmail,
            phone: phone.trim() || null,
            selected_plan: selectedPlan,
            message:
              `Preferred payment method: ${paymentMethod}` +
              (message.trim() ? `\n\n${message.trim()}` : ""),
          },
        ]);

      if (insertError) {
        setError(
          "We could not send your plan request. Check the details and try again."
        );
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong while sending your request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingPage active="pricing">
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Manual activation"
          title="Request a SydIN plan activation."
          text="Tell us which plan fits your business. Payments are handled manually during early access, and your inventory data is never deleted when plans change."
        />

        {requestSource && (
          <p className="mx-auto mt-5 w-fit max-w-full rounded-full border border-sky-200/15 bg-sky-400/10 px-4 py-2 text-center text-xs font-bold text-sky-200">
            Requested from: {requestSource}
          </p>
        )}

        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <aside className="rounded-[32px] border border-white/10 bg-white/[0.045] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
                What happens next
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight">
                A human activation flow for early users.
              </h2>

              <div className="mt-6 space-y-4">
                {[
                  "Send your plan request",
                  "We review your business needs",
                  "We contact you by email or WhatsApp",
                  "Your selected plan is activated after manual payment",
                ].map((step, index) => (
                  <div
                    key={step}
                    className="flex gap-4 rounded-2xl border border-white/10 bg-black/25 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-black">
                      {index + 1}
                    </div>

                    <p className="pt-2 text-sm font-bold text-slate-300">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[32px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_34px_130px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:p-7 lg:p-8">
              {success ? (
                <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-300/25 bg-emerald-500/15 text-emerald-100">
                    <svg
                      aria-hidden="true"
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  </div>

                  <h1 className="mt-6 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
                    Request received.
                  </h1>

                  <p className="mt-4 max-w-lg text-base leading-7 text-slate-300">
                    Choose a payment method below and send your payment
                    confirmation on WhatsApp. Your plan will be activated
                    manually during early access.
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="glass-button min-h-12 rounded-2xl px-5 py-3 text-sm"
                    >
                      Contact on WhatsApp
                    </a>

                    <Link
                      href="/pricing"
                      className="glass-button glass-button-secondary min-h-12 rounded-2xl px-5 py-3 text-sm"
                    >
                      Back to Pricing
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-400">
                        Full name
                      </label>

                      <input
                        type="text"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-400">
                        Business name
                      </label>

                      <input
                        type="text"
                        value={businessName}
                        onChange={(event) => setBusinessName(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-400">
                        Email
                      </label>

                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-400">
                        WhatsApp/phone
                      </label>

                      <input
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-bold text-slate-400">
                      Selected plan
                    </label>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {planOptions.map((plan) => (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => setSelectedPlan(plan)}
                          className={`min-h-14 rounded-2xl border px-5 py-4 text-left text-base font-black transition ${
                            selectedPlan === plan
                              ? "border-indigo-300/50 bg-indigo-500/20 text-white"
                              : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/[0.06]"
                          }`}
                        >
                          {plan}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-bold text-slate-400">
                      Payment method
                    </label>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {paymentMethods.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`min-h-14 rounded-2xl border px-5 py-4 text-left text-base font-black transition ${
                            paymentMethod === method
                              ? "border-indigo-300/50 bg-indigo-500/20 text-white"
                              : "border-white/10 bg-black/25 text-slate-300 hover:bg-white/[0.06]"
                          }`}
                        >
                          {paymentMethodLabels[method]}
                        </button>
                      ))}

                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-bold text-slate-400">
                      Message/notes
                    </label>

                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      className="min-h-[150px] w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                      placeholder="Tell us how many items you manage or anything we should know before activation."
                    />
                  </div>

                  {error && (
                    <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-200">
                      {error}
                    </div>
                  )}

                  <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      href="/pricing"
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.1]"
                    >
                      Back to Pricing
                    </Link>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-black text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "Sending request..." : `Request ${selectedPlan}`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Reveal>
        </div>

        <section
          id="payment-methods"
          className="mx-auto mt-10 max-w-7xl rounded-[34px] border border-sky-200/15 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.13),_transparent_38%),rgba(255,255,255,0.04)] p-5 shadow-[0_30px_110px_rgba(0,5,20,0.34)] backdrop-blur-2xl sm:p-7 lg:p-9"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-300">
                Manual activation
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Early access payment methods
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-400">
                Select the method that works for you, then send the transfer
                confirmation through WhatsApp so the {selectedPlan} plan can be
                activated manually.
              </p>
            </div>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="glass-button min-h-12 w-full rounded-2xl px-5 py-3 text-sm lg:w-auto"
            >
              Contact on WhatsApp
            </a>
          </div>

          {copyError && (
            <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100">
              {copyError}
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            <article className="glass-card flex min-w-0 flex-col p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200/20 bg-sky-400/10 text-sky-100">
                  <PaymentIcon method="transfer" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">
                    Local transfer
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    Whish Money
                  </h3>
                </div>
              </div>

              <dl className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Receiver name
                  </dt>
                  <dd className="mt-2 break-words text-sm font-bold text-white">
                    {RECEIVER_NAME}
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Phone / Whish number
                  </dt>
                  <dd className="mt-2 break-all text-sm font-bold text-white">
                    {WHISH_NUMBER}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-sm leading-6 text-slate-400">
                After payment, send the transfer screenshot or reference on
                WhatsApp.
              </p>
              <button
                type="button"
                onClick={() => copyPaymentDetails("whish", WHISH_NUMBER)}
                className="glass-button glass-button-secondary mt-auto min-h-12 w-full rounded-2xl px-5 py-3 text-sm"
              >
                {copiedTarget === "whish" ? "Whish number copied" : "Copy Whish number"}
              </button>
            </article>

            <article className="glass-card flex min-w-0 flex-col p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-200/20 bg-indigo-400/10 text-indigo-100">
                  <PaymentIcon method="transfer" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">
                    Local transfer
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-white">OMT</h3>
                </div>
              </div>

              <dl className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Receiver name
                  </dt>
                  <dd className="mt-2 break-words text-sm font-bold text-white">
                    {RECEIVER_NAME}
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Phone number
                  </dt>
                  <dd className="mt-2 break-all text-sm font-bold text-white">
                    {OMT_NUMBER}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-sm leading-6 text-slate-400">
                Activation is manual after payment confirmation.
              </p>
              <button
                type="button"
                onClick={() =>
                  copyPaymentDetails(
                    "omt",
                    `Receiver name: ${RECEIVER_NAME}\nPhone number: ${OMT_NUMBER}`
                  )
                }
                className="glass-button glass-button-secondary mt-auto min-h-12 w-full rounded-2xl px-5 py-3 text-sm"
              >
                {copiedTarget === "omt" ? "OMT details copied" : "Copy OMT details"}
              </button>
            </article>

            <article className="glass-card flex min-w-0 flex-col p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-400/10 text-cyan-100">
                  <PaymentIcon method="crypto" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                    Digital asset
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    USDT / Crypto
                  </h3>
                </div>
              </div>

              <dl className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Network
                  </dt>
                  <dd className="mt-2 text-sm font-bold text-white">
                    {USDT_NETWORK}
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Wallet address
                  </dt>
                  <dd className="mt-2 break-all font-mono text-xs font-bold leading-6 text-white sm:text-sm">
                    {USDT_ADDRESS}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                Send only USDT on the selected network. Wrong network payments
                may be lost.
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                Activation remains manual after payment confirmation.
              </p>
              <button
                type="button"
                onClick={() => copyPaymentDetails("crypto", USDT_ADDRESS)}
                className="glass-button glass-button-secondary mt-auto min-h-12 w-full rounded-2xl px-5 py-3 text-sm"
              >
                {copiedTarget === "crypto"
                  ? "Wallet address copied"
                  : "Copy wallet address"}
              </button>
            </article>

          </div>
        </section>
      </section>
    </MarketingPage>
  );
}

export default function RequestPlanPage() {
  return (
    <Suspense
      fallback={
        <MarketingPage active="pricing">
          <section className="px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="h-48 animate-pulse rounded-[32px] border border-white/10 bg-white/[0.045]" />
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="h-[420px] animate-pulse rounded-[32px] border border-white/10 bg-white/[0.035]" />
                <div className="h-[420px] animate-pulse rounded-[32px] border border-white/10 bg-white/[0.05]" />
              </div>
            </div>
          </section>
        </MarketingPage>
      }
    >
      <RequestPlanContent />
    </Suspense>
  );
}
