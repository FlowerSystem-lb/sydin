"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Sidebar from "@/components/Sidebar";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { supabase } from "@/app/lib/supabase";

function getLogoExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (!extension || extension.length > 8) {
    return "png";
  }

  return extension.replace(/[^a-z0-9]/g, "") || "png";
}

export default function SettingsPage() {
  const [settings, setSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data: { user }, error: userError }) => {
        if (!isActive) return;

        if (userError || !user) {
          setError("Please sign in again to manage business settings.");
          setLoading(false);
          return;
        }

        getOrCreateBusinessSettings(user.id)
          .then((loadedSettings) => {
            if (!isActive) return;

            setSettings(loadedSettings);
            setLoading(false);
          })
          .catch(() => {
            if (!isActive) return;

            setError("We could not load your business settings.");
            setLoading(false);
          });
      })
      .catch(() => {
        if (!isActive) return;

        setError("We could not confirm your session. Please sign in again.");
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving) return;

    const businessName = settings.business_name.trim();
    const lowStockThreshold = Number(settings.low_stock_threshold);

    if (!businessName) {
      setError("Add a business name before saving.");
      setSuccess("");
      return;
    }

    if (
      !Number.isFinite(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      setError("Low-stock threshold must be 0 or more.");
      setSuccess("");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in again before saving settings.");
        return;
      }

      let businessLogoUrl = settings.business_logo_url;

      if (logoFile) {
        const extension = getLogoExtension(logoFile.name);
        const logoPath = `${user.id}/logo-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("business-logos")
          .upload(logoPath, logoFile, {
            upsert: true,
          });

        if (uploadError) {
          setError(
            "Logo upload failed. Try a smaller image or a different file."
          );
          return;
        }

        const { data } = supabase.storage
          .from("business-logos")
          .getPublicUrl(logoPath);

        businessLogoUrl = data.publicUrl;
      }

      const updatedSettings = {
        business_name: businessName,
        business_logo_url: businessLogoUrl || null,
        low_stock_threshold: Math.round(lowStockThreshold),
        contact_email: settings.contact_email.trim() || null,
        contact_phone: settings.contact_phone.trim() || null,
        contact_website: settings.contact_website.trim() || null,
        show_contact_publicly: settings.show_contact_publicly,
      };

      const { data, error: updateError } = await supabase
        .from("business_settings")
        .upsert(
          {
            user_id: user.id,
            ...updatedSettings,
          },
          {
            onConflict: "user_id",
          }
        )
        .select(
          "business_name, business_logo_url, low_stock_threshold, contact_email, contact_phone, contact_website, show_contact_publicly"
        )
        .single();

      if (updateError) {
        setError("We could not save your business settings. Please try again.");
        return;
      }

      setSettings({
        business_name: data?.business_name || businessName,
        business_logo_url: data?.business_logo_url || businessLogoUrl || "",
        low_stock_threshold:
          Number(data?.low_stock_threshold) ||
          Math.round(lowStockThreshold),
        contact_email: data?.contact_email || "",
        contact_phone: data?.contact_phone || "",
        contact_website: data?.contact_website || "",
        show_contact_publicly: Boolean(data?.show_contact_publicly),
      });
      setLogoFile(null);
      setSuccess("Business settings saved.");
    } catch {
      setError("Something went wrong while saving business settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="liquid-bg min-h-screen overflow-x-hidden text-white">
      <Sidebar
        businessName={settings.business_name}
        businessLogoUrl={settings.business_logo_url}
      />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Workspace settings
                </p>

                <h1 className="mt-2 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Business
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                  Tune branding, QR page identity, and the low-stock signal for your inventory.
                </p>
              </div>

              <Link
                href="/dashboard"
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center text-base font-bold text-white transition hover:border-white/20 hover:bg-white/[0.1]"
              >
                Back to Dashboard
              </Link>
            </div>
          </section>

          <form
            onSubmit={handleSave}
            aria-busy={saving}
            className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-7 lg:p-8"
          >
            {loading ? (
              <div className="grid grid-cols-1 gap-5">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-24 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
                  >
                    <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-[180px_1fr]">
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p className="mb-4 text-sm font-semibold text-slate-400">
                      Logo preview
                    </p>

                    <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-3xl border border-indigo-300/20 bg-indigo-500/10">
                      {settings.business_logo_url ? (
                        <div className="relative h-full w-full">
                          <Image
                            src={settings.business_logo_url}
                            alt={settings.business_name}
                            fill
                            sizes="180px"
                            className="object-contain p-4"
                          />
                        </div>
                      ) : (
                        <BrandMark className="h-16 w-16 rounded-2xl" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-400">
                        Business name
                      </label>

                      <input
                        type="text"
                        value={settings.business_name}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            business_name: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-400">
                        Business logo
                      </label>

                      <div className="rounded-3xl border border-dashed border-indigo-300/25 bg-black/30 p-5 transition hover:border-indigo-300/45 hover:bg-black/40">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            setLogoFile(event.target.files?.[0] || null)
                          }
                          className="w-full cursor-pointer text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-200 transition-colors hover:file:bg-indigo-500/30"
                        />

                        {logoFile && (
                          <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-300">
                            Selected: {logoFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-400">
                      Low-stock threshold
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={settings.low_stock_threshold}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          low_stock_threshold: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-400">
                      Contact email
                    </label>

                    <input
                      type="email"
                      value={settings.contact_email}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          contact_email: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-400">
                      Contact phone
                    </label>

                    <input
                      type="tel"
                      value={settings.contact_phone}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          contact_phone: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-400">
                      Contact website
                    </label>

                    <input
                      type="url"
                      value={settings.contact_website}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          contact_website: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    />
                  </div>
                </div>

                <label className="mt-6 flex cursor-pointer flex-col gap-4 rounded-3xl border border-indigo-300/20 bg-indigo-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-bold text-white">
                      Show contact publicly
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Public QR item pages can show contact fields when this is enabled.
                    </p>
                  </div>

                  <span className="relative shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.show_contact_publicly}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          show_contact_publicly: event.target.checked,
                        }))
                      }
                      className="peer sr-only"
                    />
                    <span className="block h-7 w-12 rounded-full border border-white/15 bg-black/35 transition peer-checked:border-sky-300/40 peer-checked:bg-sky-400/25 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-300" />
                    <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-slate-400 shadow-md transition peer-checked:translate-x-5 peer-checked:bg-cyan-100" />
                  </span>
                </label>

                {(error || success) && (
                  <div
                    className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
                      error
                        ? "border-red-500/30 bg-red-500/10 text-red-200"
                        : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {error || success}
                  </div>
                )}

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Link
                    href="/dashboard"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-4 text-center text-base font-bold text-white transition hover:bg-white/[0.1]"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-white px-7 py-4 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving settings..." : "Save Settings"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
