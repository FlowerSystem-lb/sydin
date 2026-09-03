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
  /* Of every screen in SydIN this is the worst place for a torn-page glyph:
     it is what a customer sees after scanning a code in the shop. A photo that
     fails now falls back to the same "no photo" block an item without one
     gets. Holding the failed src, not a boolean, so a new photo recovers. */
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
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
    <main className="min-h-screen overflow-x-hidden bg-[var(--surface-page,#f4f7fb)] px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-lg font-semibold">
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
                <p className="break-words text-[20px] font-semibold tracking-tight">
                  {businessName}
                </p>

                <p className="text-[13px] text-slate-500">
                  Public inventory item
                </p>
              </div>
            </div>

            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">
              Powered by SydIN
            </p>
          </div>
        </header>

        {loading && (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="h-full animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
            </div>

            <div className="min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="h-full animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
            </div>
          </section>
        )}

        {!loading && (error || !item) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <h1 className="text-[28px] font-semibold">
              Item not found
            </h1>

            <p className="mx-auto mt-2 max-w-md text-[14px] text-slate-600">
              {error || "This public item is unavailable."}
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-2xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-3 text-[14px] font-medium text-white shadow-[0_12px_28px_rgba(37,99,235,0.35)] transition hover:brightness-110"
            >
              Go to SydIN
            </Link>
          </section>
        )}

        {!loading && item && (
          <>
            {/* This is the page a customer sees after scanning a QR code in a
                shop, so it gets the same rules as the workspace: labels are
                12px uppercase, facts are 14px, only the product name is large,
                and nothing is bold past 600.

                What changed and why:
                - The photo area was a card holding a bordered box holding a
                  dashed box: three nested frames, and with no photo it reserved
                  ~440px to say "not added yet". A missing photo is a small
                  fact, so it now takes one line.
                - SKU, category, quantity and created were four filled boxes.
                  They are plain facts, not states, so they are separated by
                  hairlines instead of boxed individually.
                - Every section carried a shadow AND a backdrop-blur behind an
                  opaque white fill, which blurs nothing and costs paint time on
                  the phone this page is opened on. */}
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {item.image && failedImageSrc !== item.image ? (
                  <div className="relative h-[320px] w-full sm:h-[440px]">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      priority
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      onError={() => setFailedImageSrc(item.image)}
                      className="object-contain p-4"
                    />
                  </div>
                ) : (
                  /* Sized to its content, not to a fixed height. On a phone -- 
                     which is how this page is reached, by scanning a code in a 
                     shop -- a fixed 180px block of nothing pushed the product 
                     name below the fold. */
                  <div className="flex w-full flex-col items-center justify-center gap-2 py-10 text-slate-400">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                      className="h-7 w-7"
                    >
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="8.5" cy="9.5" r="1.5" />
                      <path d="m4 17 4.5-4.5 3 3L15 12l5 5" />
                    </svg>
                    <span className="text-[13px]">No photo for this item</span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  Product
                </p>

                <h1 className="mt-1 break-words text-[28px] font-semibold leading-tight tracking-tight text-slate-900">
                  {item.name}
                </h1>

                <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
                  {[
                    { label: "Quantity", value: String(item.quantity) },
                    { label: "SKU", value: item.sku || "Not set" },
                    { label: "Category", value: item.category },
                    {
                      label: "Added",
                      value: formatCreatedDate(item.created_at),
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-4 py-3"
                    >
                      <dt className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">
                        {row.label}
                      </dt>
                      <dd className="min-w-0 break-words text-right text-[14px] font-medium text-slate-900">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {hasContact && (
                  <div className="mt-6">
                    <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">
                      Business contact
                    </p>

                    <div className="mt-2 flex flex-col gap-1.5 text-[14px] text-slate-700">
                      {item.contact_email && (
                        <a
                          href={`mailto:${item.contact_email}`}
                          className="break-all transition hover:text-slate-900"
                        >
                          {item.contact_email}
                        </a>
                      )}

                      {item.contact_phone && (
                        <a
                          href={`tel:${item.contact_phone}`}
                          className="break-all transition hover:text-slate-900"
                        >
                          {item.contact_phone}
                        </a>
                      )}

                      {publicWebsite && (
                        <a
                          href={publicWebsite}
                          className="break-all transition hover:text-slate-900"
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

            <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center sm:p-7">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Item QR Code
              </p>

              <div className="mt-5 flex flex-col items-center">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
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

                <p className="mt-4 text-[14px] text-slate-600">
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
