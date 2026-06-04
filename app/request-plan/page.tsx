"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MarketingPage,
  SectionIntro,
} from "@/components/Marketing";
import Reveal from "@/components/Reveal";
import { supabase } from "@/app/lib/supabase";

type PlanName = "Standard" | "Pro";

const planOptions: PlanName[] = ["Standard", "Pro"];

export default function RequestPlanPage() {
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanName>(() => {
    if (typeof window === "undefined") return "Standard";

    const plan = new URLSearchParams(window.location.search).get("plan");

    return plan === "Pro" ? "Pro" : "Standard";
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
            message: message.trim() || null,
          },
        ]);

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setSuccess(true);
    } catch (requestError) {
      console.log(requestError);
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
          title="Request a SydIn plan activation."
          text="Tell us which plan fits your business. We will contact you to activate Standard or Pro while payments are being prepared."
        />

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
                  "Your selected plan is activated manually",
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-300/25 bg-emerald-500/15 text-2xl font-black text-emerald-100">
                    ✓
                  </div>

                  <h1 className="mt-6 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
                    Request received. We will contact you to activate your plan.
                  </h1>

                  <p className="mt-4 max-w-md text-base leading-7 text-slate-400">
                    We will review your request and reach out using the contact details you provided.
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/pricing"
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.1]"
                    >
                      Back to Pricing
                    </Link>

                    <Link
                      href="/signup"
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-slate-200"
                    >
                      Create Account
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
      </section>
    </MarketingPage>
  );
}
