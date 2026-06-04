"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import Sidebar from "@/components/Sidebar";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
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

interface InventoryHistory {
  id: number;
  action: string;
  old_quantity: number | null;
  new_quantity: number | null;
  created_at: string;
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

function formatAction(action: string) {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function formatQuantity(quantity: number | null) {
  return quantity ?? "N/A";
}

export default function ItemDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const rawId = params.id;
  const itemId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [qrUrl, setQrUrl] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy Link");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authMissing, setAuthMissing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editError, setEditError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const fetchHistory = async (userId: string, historyItemId: number) => {
    const { data, error: historyError } = await supabase
      .from("inventory_history")
      .select("id, action, old_quantity, new_quantity, created_at")
      .eq("item_id", historyItemId)
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      });

    if (historyError) {
      console.warn("Inventory history fetch failed:", historyError.message);
      setHistory([]);
      return;
    }

    setHistory((data as InventoryHistory[]) || []);
  };

  useEffect(() => {
    if (!itemId) return;

    const timeoutId = window.setTimeout(() => {
      setQrUrl(
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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isActive) return;

      if (userError || !user) {
        setAuthMissing(true);
        setLoading(false);
        return;
      }

      const { data, error: itemError } = await supabase
        .from("inventory")
        .select("*")
        .eq("id", Number(itemId))
        .eq("user_id", user.id)
        .limit(1);

      if (!isActive) return;

      if (itemError) {
        setError(itemError.message);
        setLoading(false);
        return;
      }

      const loadedItem = (data?.[0] as Item | undefined) || null;

      setItem(loadedItem);

      if (loadedItem) {
        await fetchHistory(user.id, loadedItem.id);
      } else {
        setHistory([]);
      }

      setLoading(false);
    };

    loadItem();

    return () => {
      isActive = false;
    };
  }, [itemId]);

  const openEditModal = () => {
    if (!item) return;

    setEditName(item.name);
    setEditSku(item.sku || "");
    setEditCategory(item.category);
    setEditQuantity(String(item.quantity));
    setEditNotes(item.notes || "");
    setEditImage(null);
    setEditError("");
    setIsEditModalOpen(true);
  };

  const closeEditModal = (force = false) => {
    if (isEditing && !force) return;

    setIsEditModalOpen(false);
    setEditName("");
    setEditSku("");
    setEditCategory("");
    setEditQuantity("");
    setEditNotes("");
    setEditImage(null);
    setEditError("");
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!item || isEditing) return;

    const trimmedName = editName.trim();
    const quantityValue = Number(editQuantity);

    if (!trimmedName) {
      setEditError("Product name is required.");
      return;
    }

    if (
      editQuantity === "" ||
      Number.isNaN(quantityValue) ||
      quantityValue < 0
    ) {
      setEditError("Quantity must be 0 or more.");
      return;
    }

    try {
      setIsEditing(true);
      setEditError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setEditError("Please login before updating inventory.");
        setIsEditing(false);
        return;
      }

      let imageUrl = item.image || "";

      if (editImage) {
        const fileName = `${Date.now()}-${editImage.name}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, editImage);

        if (uploadError) {
          setEditError(uploadError.message);
          setIsEditing(false);
          return;
        }

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }

      const oldItem = { ...item };
      const updatedItem = {
        name: trimmedName,
        sku: editSku.trim(),
        category: editCategory.trim(),
        quantity: quantityValue,
        notes: editNotes,
        image: imageUrl,
      };

      const { data, error: updateError } = await supabase
        .from("inventory")
        .update(updatedItem)
        .eq("id", item.id)
        .eq("user_id", user.id)
        .select("*");

      if (updateError) {
        setEditError(updateError.message);
        setIsEditing(false);
        return;
      }

      if (!data || data.length === 0) {
        setEditError("Item not found or you do not have access to update it.");
        setIsEditing(false);
        return;
      }

      const updatedRecord = data[0] as Item;

      await logInventoryHistory({
        itemId: item.id,
        userId: user.id,
        action: "edited",
        oldQuantity: oldItem.quantity,
        newQuantity: updatedRecord.quantity,
        oldValues: oldItem,
        newValues: updatedRecord,
      });

      setItem(updatedRecord);
      await fetchHistory(user.id, item.id);
      closeEditModal(true);
    } catch (error) {
      console.log(error);
      setEditError("Something went wrong while updating this item.");
    }

    setIsEditing(false);
  };

  const deleteItem = async () => {
    if (!item || isDeleting) return;

    const confirmDelete = confirm("Delete this item?");

    if (!confirmDelete) return;

    try {
      setIsDeleting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please login before deleting inventory.");
        setIsDeleting(false);
        return;
      }

      await logInventoryHistory({
        itemId: item.id,
        userId: user.id,
        action: "deleted",
        oldQuantity: item.quantity,
        oldValues: item,
      });

      const { error: deleteError } = await supabase
        .from("inventory")
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id);

      if (deleteError) {
        setError(deleteError.message);
        setIsDeleting(false);
        return;
      }

      router.push("/dashboard/inventory");
    } catch (error) {
      console.log(error);
      setError("Something went wrong while deleting this item.");
      setIsDeleting(false);
    }
  };

  const copyQrLink = async () => {
    if (!qrUrl) return;

    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopyLabel("Copied");

      window.setTimeout(() => {
        setCopyLabel("Copy Link");
      }, 1800);
    } catch (error) {
      console.log(error);
      setCopyLabel("Copy failed");

      window.setTimeout(() => {
        setCopyLabel("Copy Link");
      }, 1800);
    }
  };

  const downloadQrCode = () => {
    const svg = qrCodeRef.current?.querySelector("svg");

    if (!svg || !item) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${item.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "item"}-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.22),_transparent_32%),radial-gradient(circle_at_80%_0%,_rgba(147,51,234,0.16),_transparent_28%),linear-gradient(135deg,_#02030a_0%,_#050713_48%,_#02030a_100%)] text-white">
      <Sidebar />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Product record
                </p>

                <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {item?.name || "Item Details"}
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                  Review item metadata, stock levels, image, notes, history, and public QR access.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard/inventory"
                  className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center text-base font-bold text-white transition hover:border-white/20 hover:bg-white/[0.1]"
                >
                  Back to Inventory
                </Link>

                {item && (
                  <>
                    <button
                      type="button"
                      onClick={openEditModal}
                      className="rounded-2xl bg-white px-5 py-4 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200"
                    >
                      Edit Item
                    </button>

                    <button
                      type="button"
                      onClick={deleteItem}
                      disabled={isDeleting}
                      className="rounded-2xl border border-red-400/25 bg-red-500/15 px-5 py-4 text-base font-bold text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
                    >
                      {isDeleting ? "Deleting..." : "Delete Item"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {loading && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="min-h-[420px] overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.28)]">
                <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
              </div>

              <div className="min-h-[420px] overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.28)]">
                <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
              </div>
            </div>
          )}

          {!loading && authMissing && (
            <div className="rounded-[32px] border border-red-500/30 bg-red-500/10 p-8 text-center text-red-200">
              Please login to view this item.
            </div>
          )}

          {!loading && !authMissing && (error || !item) && (
            <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <h2 className="text-3xl font-bold">
                Item not found
              </h2>

              <p className="mx-auto mt-3 max-w-md text-slate-400">
                {error || "This item does not exist or you do not have access to it."}
              </p>

              <Link
                href="/dashboard/inventory"
                className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-slate-200"
              >
                Back to Inventory
              </Link>
            </div>
          )}

          {!loading && item && (
            <>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-6">
                <div className="flex min-h-[360px] items-center justify-center rounded-[28px] bg-[#f4f0e8] p-5 sm:min-h-[460px]">
                  {item.image ? (
                    <div className="relative h-[320px] w-full sm:h-[420px]">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="(min-width: 1280px) 55vw, 100vw"
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-3xl border border-slate-300/35 bg-white/35 text-center text-slate-500">
                      <span className="text-sm font-black uppercase tracking-[0.18em]">
                        Image
                      </span>

                      <span className="mt-2 text-base font-semibold">
                        Not added yet
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <section className="flex flex-col gap-6">
                <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                        Product
                      </p>

                      <h2 className="mt-2 break-words text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        {item.name}
                      </h2>
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

                      <p className="mt-2 break-words text-lg font-bold text-white">
                        {item.sku || "N/A"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <p className="text-sm font-semibold text-slate-500">
                        Category
                      </p>

                      <p className="mt-2 break-words text-lg font-bold text-white">
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

                      <p className="mt-2 text-lg font-bold text-white">
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

                <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                    Item QR Code
                  </p>

                  <div className="mt-5 flex flex-col items-center justify-center rounded-3xl border border-indigo-300/25 bg-black/25 p-5 text-center sm:p-6">
                    <div
                      ref={qrCodeRef}
                      className="rounded-3xl bg-white p-4 shadow-[0_24px_80px_rgba(255,255,255,0.08)]"
                    >
                      {qrUrl ? (
                        <QRCode
                          value={qrUrl}
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

                    <h3 className="mt-5 text-2xl font-bold">
                      Item QR Code
                    </h3>

                    <p className="mt-2 text-slate-400">
                      Scan to open this item page.
                    </p>

                    <p className="mt-2 text-sm text-indigo-200">
                      This QR opens the public item page.
                    </p>

                    {qrUrl && (
                      <p className="mt-3 max-w-full break-all rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs text-slate-400">
                        {qrUrl}
                      </p>
                    )}

                    <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={copyQrLink}
                        disabled={!qrUrl}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                      >
                        {copyLabel}
                      </button>

                      <button
                        type="button"
                        onClick={downloadQrCode}
                        disabled={!qrUrl}
                        className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
                      >
                        Download QR
                      </button>
                    </div>
                  </div>
                </div>
              </section>
              </div>

              <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                      Audit trail
                    </p>

                    <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      Item History
                    </h2>
                  </div>

                  <span className="self-start rounded-full border border-indigo-300/25 bg-indigo-500/15 px-4 py-2 text-sm font-bold text-indigo-100 sm:self-auto">
                    {history.length} {history.length === 1 ? "entry" : "entries"}
                  </span>
                </div>

                {history.length > 0 ? (
                  <div className="mt-6 space-y-4">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="relative rounded-[26px] border border-white/10 bg-black/25 p-4 sm:p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-500/15 text-sm font-black text-indigo-100">
                              {formatAction(entry.action).charAt(0)}
                            </div>

                            <div>
                              <h3 className="text-xl font-bold text-white">
                                {formatAction(entry.action)}
                              </h3>

                              <p className="mt-1 text-sm font-medium text-slate-400">
                                {formatCreatedDate(entry.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[340px]">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Old quantity
                              </p>

                              <p className="mt-2 text-2xl font-black text-slate-200">
                                {formatQuantity(entry.old_quantity)}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                New quantity
                              </p>

                              <p className="mt-2 text-2xl font-black text-indigo-100">
                                {formatQuantity(entry.new_quantity)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-[26px] border border-dashed border-indigo-300/25 bg-black/25 px-5 py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-500/15 text-lg font-black text-indigo-100">
                      0
                    </div>

                    <h3 className="mt-5 text-2xl font-bold text-white">
                      No history yet
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-base leading-7 text-slate-400">
                      Create, edit, and delete activity for this item will appear here as the record changes.
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {isEditModalOpen && item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#02030a]/80 p-4 backdrop-blur-xl">
          <div className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#080b18]/90 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-7 md:p-9">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Product details
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Edit Item</h2>
              </div>

              <button
                type="button"
                onClick={() => closeEditModal()}
                disabled={isEditing}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-2 text-slate-400 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-50"
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="flex flex-col gap-5 sm:gap-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">Product Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">SKU</label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="min-h-[110px] w-full resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">Replace Image</label>
                <div className="grid grid-cols-1 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 md:grid-cols-[140px_1fr]">
                  {item.image ? (
                    <div className="relative h-[120px] overflow-hidden rounded-2xl bg-[#f4f0e8] p-3">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-contain p-3"
                      />
                    </div>
                  ) : (
                    <div className="flex h-[120px] flex-col items-center justify-center rounded-2xl bg-[#f4f0e8] text-slate-500">
                      <span className="text-xs font-black uppercase tracking-[0.16em]">
                        Image
                      </span>

                      <span className="mt-1 text-xs font-semibold">
                        Not added
                      </span>
                    </div>
                  )}

                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditImage(e.target.files?.[0] || null)}
                      className="w-full cursor-pointer text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-200 transition-colors hover:file:bg-indigo-500/30"
                    />

                    {editImage && (
                      <p className="mt-3 text-sm text-slate-400">
                        New image: {editImage.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {editError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-200">
                  {editError}
                </div>
              )}

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => closeEditModal()}
                  disabled={isEditing}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] py-4 text-base font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isEditing}
                  className="flex-1 rounded-2xl bg-white py-4 text-base font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
                >
                  {isEditing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
