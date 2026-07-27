"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";
import BrandMark from "@/components/BrandMark";
import { supabase } from "@/app/lib/supabase";

interface PublicItem {
  name: string;
  category: string;
  quantity: number;
  image: string;
  sku?: string | null;
  created_at?: string | null;
  business_name?: string | null;
  business_logo_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_website?: string | null;
}

function formatCreatedDate(date?: string | null) {
  if (!date) return "Not available";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function normalizePublicItem(data: unknown): PublicItem | null {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") return null;

  const item = row as Partial<PublicItem>;

  if (!item.name) return null;

  return {
    name: item.name,
    category: item.category || "Uncategorized",
    quantity: Number(item.quantity || 0),
    image: item.image || "",
    sku: item.sku || "",
    created_at: item.created_at || null,
    business_name: item.business_name || "SydIN",
    business_logo_url: item.business_logo_url || "",
    contact_email: item.contact_email || "",
    contact_phone: item.contact_phone || "",
    contact_website: item.contact_website || "",
  };
}

function getSafePublicWebsite(value?: string | null) {
  const website = value?.trim();

  if (!website) return "";

  try {
    const url = new URL(website);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export default function PublicItemPage() {
  const params = useParams();
  const rawPublicId = params.id;
  const publicId = Array.isArray(rawPublicId) ? rawPublicId[0] : rawPublicId;

  const [item, setItem] = useState<PublicItem | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!publicId) return;

    const timeoutId = window.setTimeout(() => {
      setPublicUrl(`${window.location.origin}/item/${publicId}`);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [publicId]);

  useEffect(() => {
    let isActive = true;

    const loadItem = async () => {
      if (!publicId) {
        if (isActive) {
          setError("Item not found.");
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error: itemError } = await supabase.rpc(
          "get_public_item",
          {
            p_public_id: publicId,
          }
        );

        if (!isActive) return;

        if (itemError) {
          setError("This public item is unavailable or the link is invalid.");
          setLoading(false);
          return;
        }

        setItem(normalizePublicItem(data));
        setLoading(false);
      } catch {
        if (!isActive) return;

        setError("This public item is unavailable or the link is invalid.");
        setLoading(false);
      }
    };

    loadItem();

    return () => {
      isActive = false;
    };
  }, [publicId]);

  const businessName = item?.business_name || "SydIN";
  const businessLogoUrl = item?.business_logo_url || "";
  const publicWebsite = getSafePublicWebsite(item?.contact_website);
  const hasContact =
    Boolean(item?.contact_email) ||
    Boolean(item?.contact_phone) ||
    Boolean(publicWebsite);

  return (
    <main className="liquid-bg min-h-screen overflow-x-hidden px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.06)] backdrop-blur-2xl sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-lg font-black">
                {businessLogoUrl ? (
                  <Image
                    src={businessLogoUrl}
                    alt={businessName}
                    fill
                    sizes="48px"
                    className="object-contain p-1"
                  />
                ) : (
                  <BrandMark compact className="border-0 shadow-none" />
                )}
              </div>

              <div>
                <p className="break-words text-2xl font-bold tracking-tight">
                  {businessName}
                </p>

                <p className="text-sm text-slate-600">
                  Public inventory item
                </p>
              </div>
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
              Powered by SydIN
            </p>
          </div>
        </header>

        {loading && (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
              <div className="h-full animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
            </div>

            <div className="min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
              <div className="h-full animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
            </div>
          </section>
        )}

        {!loading && (error || !item) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_4px_16px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <h1 className="text-3xl font-bold">
              Item not found
            </h1>

            <p className="mx-auto mt-3 max-w-md text-slate-600">
              {error || "This public item is unavailable."}
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-2xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-3 font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.35)] transition hover:brightness-110"
            >
              Go to SydIN
            </Link>
          </section>
        )}

        {!loading && item && (
          <>
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)] backdrop-blur-2xl sm:p-5">
                <div className="flex min-h-[320px] items-center justify-center rounded-[26px] bg-[#f4f0e8] p-5 sm:min-h-[440px]">
                  {item.image ? (
                    <div className="relative h-[280px] w-full sm:h-[400px]">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        priority
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-[280px] w-full flex-col items-center justify-center rounded-3xl border border-slate-300/35 bg-white/35 text-center text-slate-600">
                      <span className="text-sm font-black uppercase tracking-[0.18em]">
                        Image
                      </span>

                      <span className="mt-2 text-base font-semibold">
                        Not added yet
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.06)] backdrop-blur-2xl sm:p-7">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-700">
                    Product
                  </p>

                  <h1 className="mt-2 break-words text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                    {item.name}
                  </h1>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-600">
                      SKU
                    </p>

                    <p className="mt-2 break-words text-lg font-bold">
                      {item.sku || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-600">
                      Category
                    </p>

                    <p className="mt-2 break-words text-lg font-bold">
                      {item.category}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-600">
                      Quantity
                    </p>

                    <p className="mt-2 text-3xl font-black text-slate-900">
                      {item.quantity}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-600">
                      Created
                    </p>

                    <p className="mt-2 text-lg font-bold">
                      {formatCreatedDate(item.created_at)}
                    </p>
                  </div>
                </div>

                {hasContact && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-violet-700">
                      Business contact
                    </p>

                    <div className="mt-3 flex flex-col gap-2 text-sm font-semibold text-slate-700">
                      {item.contact_email && (
                        <a
                          href={`mailto:${item.contact_email}`}
                          className="break-all transition hover:text-violet-700"
                        >
                          {item.contact_email}
                        </a>
                      )}

                      {item.contact_phone && (
                        <a
                          href={`tel:${item.contact_phone}`}
                          className="break-all transition hover:text-violet-700"
                        >
                          {item.contact_phone}
                        </a>
                      )}

                      {publicWebsite && (
                        <a
                          href={publicWebsite}
                          className="break-all transition hover:text-violet-700"
                          rel="noreferrer"
                          target="_blank"
                        >
                          {item.contact_website}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-[0_4px_16px_rgba(15,23,42,0.06)] backdrop-blur-2xl sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-700">
                Item QR Code
              </p>

              <div className="mt-5 flex flex-col items-center">
                <div className="rounded-3xl bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.08)]">
                  {publicUrl ? (
                    <QRCode
                      value={publicUrl}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#02030a"
                      level="M"
                    />
                  ) : (
                    <div className="flex h-[180px] w-[180px] items-center justify-center text-sm font-semibold text-slate-600">
                      Preparing QR...
                    </div>
                  )}
                </div>

                <p className="mt-5 text-slate-600">
                  Scan to open this public item page.
                </p>

                {publicUrl && (
                  <p className="mt-3 max-w-full break-all rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    {publicUrl}
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
