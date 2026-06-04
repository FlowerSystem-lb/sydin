"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";
import { supabase } from "@/app/lib/supabase";

interface Item {
  id: number;
  name: string;
  category: string;
  quantity: number;
  image: string;
  sku?: string;
  notes?: string;
  created_at?: string;
}

const LOW_STOCK_THRESHOLD = 10;

function formatCreatedDate(date?: string) {
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

export default function PublicItemPage() {
  const params = useParams();
  const rawId = params.id;
  const itemId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [item, setItem] = useState<Item | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!itemId) return;

    const timeoutId = window.setTimeout(() => {
      setPublicUrl(
        `${window.location.origin}/item/${itemId}`
      );
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [itemId]);

  useEffect(() => {
    let isActive = true;

    const loadItem = async () => {
      if (!itemId) {
        if (isActive) {
          setError("Item not found.");
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error: itemError } = await supabase
          .from("inventory")
          .select("*")
          .eq("id", Number(itemId))
          .limit(1);

        if (!isActive) return;

        if (itemError) {
          setError("We could not load this public item. Try scanning again.");
          setLoading(false);
          return;
        }

        setItem((data?.[0] as Item | undefined) || null);
        setLoading(false);
      } catch {
        if (!isActive) return;

        setError("We could not load this public item. Try scanning again.");
        setLoading(false);
      }
    };

    loadItem();

    return () => {
      isActive = false;
    };
  }, [itemId]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.22),_transparent_32%),radial-gradient(circle_at_80%_0%,_rgba(147,51,234,0.16),_transparent_28%),linear-gradient(135deg,_#02030a_0%,_#050713_48%,_#02030a_100%)] px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 text-lg font-black shadow-[0_20px_60px_rgba(124,58,237,0.35)]">
              S
            </div>

            <div>
              <p className="text-2xl font-bold tracking-tight">
                SydIn
              </p>

              <p className="text-sm text-slate-400">
                Public inventory item
              </p>
            </div>
          </div>
        </header>

        {loading && (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="min-h-[360px] overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.28)]">
              <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
            </div>

            <div className="min-h-[360px] overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.28)]">
              <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
            </div>
          </section>
        )}

        {!loading && (error || !item) && (
          <section className="rounded-[30px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <h1 className="text-3xl font-bold">
              Item not found
            </h1>

            <p className="mx-auto mt-3 max-w-md text-slate-400">
              {error || "This public item is unavailable."}
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-slate-200"
            >
              Go to SydIn
            </Link>
          </section>
        )}

        {!loading && item && (
          <>
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-5">
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
                    <div className="flex min-h-[280px] w-full flex-col items-center justify-center rounded-3xl border border-slate-300/35 bg-white/35 text-center text-slate-500">
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

              <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                      Product
                    </p>

                    <h1 className="mt-2 break-words text-4xl font-bold tracking-tight text-white sm:text-5xl">
                      {item.name}
                    </h1>
                  </div>

                  {item.quantity <= LOW_STOCK_THRESHOLD && (
                    <span className="self-start rounded-full border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm font-bold text-red-300">
                      Low Stock
                    </span>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold text-slate-500">
                      SKU
                    </p>

                    <p className="mt-2 break-words text-lg font-bold">
                      {item.sku || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold text-slate-500">
                      Category
                    </p>

                    <p className="mt-2 break-words text-lg font-bold">
                      {item.category}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold text-slate-500">
                      Quantity
                    </p>

                    <p className="mt-2 text-3xl font-black text-indigo-100">
                      {item.quantity}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold text-slate-500">
                      Created
                    </p>

                    <p className="mt-2 text-lg font-bold">
                      {formatCreatedDate(item.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm font-semibold text-slate-500">
                    Notes
                  </p>

                  <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-slate-300">
                    {item.notes || "No notes added yet."}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 text-center shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                Item QR Code
              </p>

              <div className="mt-5 flex flex-col items-center">
                <div className="rounded-3xl bg-white p-4 shadow-[0_24px_80px_rgba(255,255,255,0.08)]">
                  {publicUrl ? (
                    <QRCode
                      value={publicUrl}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#02030a"
                      level="M"
                    />
                  ) : (
                    <div className="flex h-[180px] w-[180px] items-center justify-center text-sm font-semibold text-slate-500">
                      Preparing QR...
                    </div>
                  )}
                </div>

                <p className="mt-5 text-slate-400">
                  Scan to open this public item page.
                </p>

                {publicUrl && (
                  <p className="mt-3 max-w-full break-all rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs text-slate-400">
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
