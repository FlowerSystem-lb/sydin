"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import UiIcon from "@/components/UiIcon";
import SydINMark from "@/components/brand/SydINMark";
import SydINWordmark from "@/components/brand/SydINWordmark";
import {
  SCANNER_REQUEST_STORAGE_KEY,
} from "@/app/lib/scannerNavigation";
import { supabase } from "@/app/lib/supabase";

interface QrInventoryItem {
  id: number;
  name: string;
  image: string;
  sku?: string | null;
  item_code?: string | null;
  public_id?: string | null;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "item"
  );
}

export default function QrCenterPage() {
  const router = useRouter();
  const qrRefs = useRef(new Map<number, HTMLDivElement>());
  const [items, setItems] = useState<QrInventoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) throw new Error("Please sign in again to use QR Center.");

        const { data, error: itemError } = await supabase
          .from("inventory")
          .select("id, name, image, sku, item_code, public_id")
          .eq("user_id", user.id)
          .order("name", { ascending: true });

        if (itemError) throw itemError;
        if (!active) return;

        setOrigin(window.location.origin);
        setItems((data || []) as QrInventoryItem[]);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load QR Center."
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleItems = items.filter((item) =>
    [item.name, item.sku, item.item_code]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  );
  const printableItems = useMemo(
    () =>
      items.filter(
        (item) => selectedIds.has(item.id) && Boolean(item.public_id)
      ),
    [items, selectedIds]
  );
  const selectedItem = printableItems[0] || null;

  const toggleItem = (itemId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const selectable = visibleItems.filter((item) => item.public_id);
      const allSelected = selectable.every((item) => next.has(item.id));

      selectable.forEach((item) => {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      });
      return next;
    });
  };

  const getQrUrl = (item: QrInventoryItem) =>
    item.public_id ? `${origin}/item/${item.public_id}` : "";

  const downloadQr = (item: QrInventoryItem) => {
    const svg = qrRefs.current.get(item.id)?.querySelector("svg");
    if (!svg) return;

    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(item.name)}-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openExistingScanner = () => {
    try {
      window.sessionStorage.setItem(SCANNER_REQUEST_STORAGE_KEY, "true");
    } catch {
      // The inventory route can still open without storage access.
    }
    router.push("/dashboard/inventory");
  };

  return (
    <main>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 print:block">
        <section className="rounded-[24px] border border-theme bg-theme-surface p-4 shadow-[0_14px_42px_rgba(15,23,42,0.08)] sm:p-5 print:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
            Operations
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-theme-primary sm:text-4xl">
            QR Center
          </h1>
          <p className="mt-1 text-sm leading-6 text-theme-muted">
            Generate public SydIN item labels or open the existing inventory
            scanner.
          </p>
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger print:hidden"
          >
            {error}
          </p>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)] print:hidden">
          <section className="rounded-[22px] border border-theme bg-theme-surface p-4 shadow-[0_12px_36px_rgba(15,23,42,0.07)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-theme-primary">
                  Generate QR Codes
                </h2>
                <p className="mt-1 text-sm text-theme-muted">
                  Select one or more items with public item links.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  disabled={visibleItems.length === 0}
                  className="rounded-xl border border-theme bg-theme-surface px-3 py-2.5 text-xs font-bold text-theme-primary hover:bg-theme-hover disabled:opacity-50"
                >
                  Select visible
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={printableItems.length === 0}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  Print selected ({printableItems.length})
                </button>
              </div>
            </div>

            <label className="relative mt-4 block">
              <span className="sr-only">Search inventory</span>
              <UiIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search item name, SKU, or item code"
                className="w-full rounded-xl border border-theme bg-theme-inset py-2.5 pl-10 pr-3 text-sm text-theme-primary outline-none focus:border-indigo-300/60 focus:ring-4 focus:ring-indigo-400/10"
              />
            </label>

            <div className="mt-4 grid max-h-[520px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {loading ? (
                [1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="h-20 animate-pulse rounded-xl bg-theme-inset"
                  />
                ))
              ) : visibleItems.length > 0 ? (
                visibleItems.map((item) => {
                  const selected = selectedIds.has(item.id);

                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                        selected
                          ? "border-indigo-300/60 bg-indigo-500/10 ring-4 ring-indigo-400/10"
                          : "border-theme bg-theme-surface hover:bg-theme-hover"
                      } ${!item.public_id ? "cursor-not-allowed opacity-55" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleItem(item.id)}
                        disabled={!item.public_id}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-theme bg-theme-inset">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center">
                            <UiIcon
                              name="box"
                              className="h-4 w-4 text-theme-subtle"
                            />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-theme-primary">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-theme-subtle">
                          {item.sku || item.item_code || "No identifier"}
                          {!item.public_id ? " · QR unavailable" : ""}
                        </span>
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="col-span-full py-10 text-center text-sm text-theme-muted">
                  No matching inventory items.
                </p>
              )}
            </div>
          </section>

          <div className="grid gap-4">
            <section className="rounded-[22px] border border-theme bg-theme-surface p-5 shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
              <h2 className="text-xl font-black text-theme-primary">
                QR Preview
              </h2>
              {selectedItem ? (
                <div className="mt-4 text-center">
                  <div
                    ref={(node) => {
                      if (node) qrRefs.current.set(selectedItem.id, node);
                    }}
                    className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <QRCode
                      value={getQrUrl(selectedItem)}
                      size={190}
                      level="M"
                    />
                  </div>
                  <p className="mt-3 font-bold text-theme-primary">
                    {selectedItem.name}
                  </p>
                  <p className="mt-1 text-xs text-theme-subtle">
                    {selectedItem.sku ||
                      selectedItem.item_code ||
                      "SydIN inventory item"}
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadQr(selectedItem)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary hover:bg-theme-hover"
                  >
                    <UiIcon name="download" className="h-4 w-4" />
                    Download QR
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-theme bg-theme-inset px-4 py-10 text-center">
                  <UiIcon
                    name="qr"
                    className="mx-auto h-8 w-8 text-theme-accent"
                  />
                  <p className="mt-3 text-sm text-theme-muted">
                    Select an item to preview its QR code.
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-[22px] border border-theme bg-theme-surface p-5 shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
              <h2 className="text-xl font-black text-theme-primary">
                Scan QR Code
              </h2>
              <p className="mt-2 text-sm leading-6 text-theme-muted">
                Open the existing SydIN ZXing scanner. Valid public item QR
                codes open the matching item details page.
              </p>
              <button
                type="button"
                onClick={openExistingScanner}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-theme bg-theme-surface px-4 py-3 text-sm font-bold text-theme-primary hover:bg-theme-hover"
              >
                <UiIcon name="scan" className="h-5 w-5" />
                Start Camera Scanner
              </button>
            </section>
          </div>
        </div>

        <section className="hidden print:grid print:grid-cols-2 print:gap-4">
          {printableItems.map((item) => (
            <article
              key={item.id}
              className="break-inside-avoid rounded-xl border border-slate-300 bg-white p-5 text-center text-slate-950"
            >
              <div className="mb-3 flex items-center justify-center gap-2">
                <SydINMark size="sm" />
                <SydINWordmark size="sm" variant="light-background" />
              </div>
              <div
                ref={(node) => {
                  if (node) qrRefs.current.set(item.id, node);
                }}
                className="mx-auto w-fit"
              >
                <QRCode value={getQrUrl(item)} size={180} level="M" />
              </div>
              <h2 className="mt-3 text-lg font-bold">{item.name}</h2>
              <p className="mt-1 text-xs text-slate-600">
                {item.sku || item.item_code || "SydIN inventory item"}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
