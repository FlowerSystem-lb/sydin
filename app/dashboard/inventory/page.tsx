"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import { supabase } from "@/app/lib/supabase";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getPlanLimitMessage,
  getSubscriptionUsage,
  type SubscriptionUsage,
} from "@/app/lib/subscription";

interface Item {
  id: number;
  name: string;
  category: string;
  quantity: number;
  image: string;
  sku?: string;
  notes?: string;
}

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

export default function InventoryPage() {
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [loadingItems, setLoadingItems] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [isLimitError, setIsLimitError] = useState(false);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [usageLoading, setUsageLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editError, setEditError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchItems = async () => {
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      setPageError("Please sign in again to view your inventory.");
      setUsageLoading(false);
      return;
    }

    const [{ data, error }, usage] = await Promise.all([
      supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user.id)
        .order("id", {
          ascending: false,
        }),
      getSubscriptionUsage(user.id),
    ]);

    if (error) {
      setPageError("We could not load your inventory. Refresh the page and try again.");
      setUsageLoading(false);
      return;
    }

    setItems(data || []);
    setSubscriptionUsage(usage);
    setUsageLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
      if (!isActive) return;

      if (userError) {
        setPageError("We could not confirm your session. Please sign in again.");
        setLoadingItems(false);
        setUsageLoading(false);
        return;
      }

      if (!user) {
        setPageError("Please sign in again to view your inventory.");
        setLoadingItems(false);
        setUsageLoading(false);
        return;
      }

      Promise.all([
        supabase
          .from("inventory")
          .select("*")
          .eq("user_id", user.id)
          .order("id", {
            ascending: false,
          }),
        getSubscriptionUsage(user.id),
      ])
        .then(([{ data, error }, usage]) => {
          if (!isActive) return;

          if (error) {
            setPageError("We could not load your inventory. Refresh the page and try again.");
            setLoadingItems(false);
            setUsageLoading(false);
            return;
          }

          setItems(data || []);
          setSubscriptionUsage(usage);
          setLoadingItems(false);
          setUsageLoading(false);
        })
        .catch(() => {
          if (!isActive) return;

          setPageError("Something went wrong while loading inventory.");
          setLoadingItems(false);
          setUsageLoading(false);
        });
    }).catch(() => {
      if (!isActive) return;

      setPageError("Something went wrong while checking your session.");
      setLoadingItems(false);
      setUsageLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAdding) return;

    setIsLimitError(false);

    const trimmedName = name.trim();
    const quantityValue = Number(quantity);

    if (!trimmedName) {
      setAddError("Add a product name before saving.");
      return;
    }

    if (
      quantity === "" ||
      Number.isNaN(quantityValue) ||
      quantityValue < 0
    ) {
      setAddError("Enter a quantity of 0 or more before saving.");
      return;
    }

    try {
      setIsAdding(true);
      setAddError("");
      setPageError("");
      setPageNotice("");

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAddError("Please sign in again before adding inventory.");
        return;
      }

      const usage = await getSubscriptionUsage(user.id, {
        strictCount: true,
      });
      setSubscriptionUsage(usage);

      if (usage.usedItems >= usage.subscription.item_limit) {
        setAddError(getPlanLimitMessage(usage.subscription.plan));
        setIsLimitError(true);
        return;
      }

      let imageUrl = "";
      if (image) {
        const fileName = `${Date.now()}-${image.name}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, image);

        if (uploadError) {
          setAddError(
            "Image upload failed. Try a smaller file or a different image."
          );
          return;
        }

        const { data } = supabase.storage.from("products").getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const newItem = {
        name: trimmedName,
        sku: sku.trim(),
        category: category.trim(),
        quantity: quantityValue,
        notes,
        image: imageUrl,
        user_id: user.id,
      };

      const { data: createdItem, error } = await supabase
        .from("inventory")
        .insert([newItem])
        .select("*")
        .single();

      if (error) {
        setAddError("We could not save this item. Please try again.");
        return;
      }

      if (createdItem) {
        await logInventoryHistory({
          itemId: createdItem.id,
          userId: user.id,
          action: "created",
          newQuantity: createdItem.quantity,
          newValues: createdItem,
        });
      }

      setPageNotice("Item added successfully.");
      setIsModalOpen(false);
      setName("");
      setSku("");
      setCategory("");
      setQuantity("");
      setNotes("");
      setImage(null);
      await fetchItems();
    } catch (error) {
      setAddError(
        error instanceof Error
          ? error.message
          : "Something went wrong while adding this item."
      );
    } finally {
      setIsAdding(false);
    }
  };

  const openEditModal = (item: Item) => {
    setSelectedItem(item);
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
    setSelectedItem(null);
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

    if (!selectedItem || isEditing) return;

    const trimmedName = editName.trim();
    const quantityValue = Number(editQuantity);

    if (!trimmedName) {
      setEditError("Add a product name before saving.");
      return;
    }

    if (
      editQuantity === "" ||
      Number.isNaN(quantityValue) ||
      quantityValue < 0
    ) {
      setEditError("Enter a quantity of 0 or more before saving.");
      return;
    }

    try {
      setIsEditing(true);
      setEditError("");
      setPageError("");
      setPageNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setEditError("Please sign in again before updating inventory.");
        setIsEditing(false);
        return;
      }

      let imageUrl = selectedItem.image || "";

      if (editImage) {
        const fileName = `${Date.now()}-${editImage.name}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, editImage);

        if (uploadError) {
          setEditError(
            "Image upload failed. Try a smaller file or a different image."
          );
          setIsEditing(false);
          return;
        }

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }

      const oldItem = { ...selectedItem };
      const updatedItem = {
        name: trimmedName,
        sku: editSku.trim(),
        category: editCategory.trim(),
        quantity: quantityValue,
        notes: editNotes,
        image: imageUrl,
      };

      const { data, error } = await supabase
        .from("inventory")
        .update(updatedItem)
        .eq("id", selectedItem.id)
        .eq("user_id", user.id)
        .select("*");

      if (error) {
        setEditError("We could not update this item. Please try again.");
        setIsEditing(false);
        return;
      }

      if (!data || data.length === 0) {
        setEditError("Item not found or you do not have access to update it.");
        setIsEditing(false);
        return;
      }

      await logInventoryHistory({
        itemId: selectedItem.id,
        userId: user.id,
        action: "edited",
        oldQuantity: oldItem.quantity,
        newQuantity: (data[0] as Item).quantity,
        oldValues: oldItem,
        newValues: data[0],
      });

      await fetchItems();
      setPageNotice("Item updated successfully.");
      closeEditModal(true);
    } catch {
      setEditError("Something went wrong while updating this item.");
    } finally {
      setIsEditing(false);
    }
  };

  const deleteItem = async (
    id: number
  ) => {
    if (deletingId) return;

    const confirmDelete =
      confirm("Delete this item?");

    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      setPageError("");
      setPageNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPageError("Please sign in again before deleting inventory.");
        return;
      }

      const itemToDelete = items.find((item) => item.id === id);

      if (itemToDelete) {
        await logInventoryHistory({
          itemId: itemToDelete.id,
          userId: user.id,
          action: "deleted",
          oldQuantity: itemToDelete.quantity,
          oldValues: itemToDelete,
        });
      }

      const { error } =
        await supabase
          .from("inventory")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);

      if (error) {
        setPageError("We could not delete this item. Please try again.");
        return;
      }

      setPageNotice("Item deleted successfully.");
      await fetchItems();
    } catch {
      setPageError("Something went wrong while deleting this item.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredItems =
    items.filter(
      (item) =>
        item.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        item.category
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    );

  const currentPlanName = formatPlanName(subscriptionUsage.subscription.plan);
  const itemUsageText = `${subscriptionUsage.usedItems} / ${subscriptionUsage.subscription.item_limit} items`;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.22),_transparent_32%),radial-gradient(circle_at_80%_0%,_rgba(147,51,234,0.16),_transparent_28%),linear-gradient(135deg,_#02030a_0%,_#050713_48%,_#02030a_100%)] text-white">
      <Sidebar
        onAddItem={() => {
          setAddError("");
          setIsLimitError(false);
          setIsModalOpen(true);
        }}
        planName={currentPlanName}
        itemUsage={usageLoading ? "... / ... items" : itemUsageText}
      />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Products
                </p>

                <h1 className="mt-2 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Inventory
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                  Manage products, stock, categories, and item details.
                </p>
              </div>

              <Link
                href="/dashboard/add-item"
                className="rounded-2xl bg-white px-5 py-4 text-center text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200"
              >
                Add Item
              </Link>
            </div>
          </section>

          {(pageNotice || pageError) && (
            <div
              className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
                pageError
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {pageError || pageNotice}
            </div>
          )}

          {/* Search */}
          <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-5">
            <label className="mb-3 block text-sm font-semibold text-slate-400">
              Search inventory
            </label>

            <div className="relative">
              <svg
                className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>

              <input
                type="text"
                placeholder="Search by product or category..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                className="w-full rounded-2xl border border-white/10 bg-black/35 py-4 pl-14 pr-5 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
              />
            </div>
          </section>

          {/* Items */}
          {loadingItems ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-[460px] overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
                >
                  <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredItems.map((item) => (
                <div
                key={item.id}
                role="link"
                tabIndex={0}
                onClick={() =>
                  router.push(
                    `/dashboard/inventory/${item.id}`
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" ||
                    e.key === " "
                  ) {
                    e.preventDefault();
                    router.push(
                      `/dashboard/inventory/${item.id}`
                    );
                  }
                }}
                className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-1.5 hover:border-indigo-300/35 hover:bg-white/[0.075] focus:outline-none focus:ring-4 focus:ring-indigo-400/20"
              >
                {item.image ? (
                  <div className="flex h-[220px] w-full items-center justify-center overflow-hidden border-b border-white/10 bg-[#f4f0e8] p-4 md:h-[240px] xl:h-[250px]">
                    <div className="relative h-full w-full">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        loading="lazy"
                        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[220px] w-full items-center justify-center border-b border-white/10 bg-[#f4f0e8] p-5 text-slate-500 md:h-[240px] xl:h-[250px]">
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border border-slate-300/35 bg-white/35 text-center">
                      <span className="text-sm font-black uppercase tracking-[0.16em]">
                        Image
                      </span>

                      <span className="mt-2 text-sm font-semibold">
                        Not added
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="break-words text-2xl font-bold tracking-tight text-white">
                        {item.name}
                      </h2>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-300">
                          SKU {item.sku || "N/A"}
                        </span>

                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-300">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-2xl border border-indigo-300/25 bg-indigo-500/15 px-3 py-2 text-lg font-black text-indigo-100">
                      Qty {item.quantity}
                    </span>
                  </div>

                  {/* Low stock */}
                  {item.quantity <=
                    10 && (
                    <div className="mt-5 inline-block self-start rounded-full border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm font-bold text-red-300">
                      Low Stock
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto flex gap-3 pt-6">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(
                          item
                        );
                      }}
                      className="min-h-[52px] flex-1 rounded-2xl bg-white/90 py-3 text-base font-bold text-black transition hover:bg-white"
                    >
                      Edit
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteItem(
                          item.id
                        );
                      }}
                      disabled={deletingId === item.id}
                      className="min-h-[52px] flex-1 rounded-2xl border border-red-400/25 bg-red-500/15 py-3 text-base font-bold text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loadingItems && filteredItems.length ===
            0 && (
            <div className="mt-2 flex flex-col items-center justify-center rounded-[32px] border border-dashed border-indigo-300/25 bg-white/[0.045] px-4 py-20 text-center shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-indigo-300/20 bg-indigo-500/15 text-2xl font-black text-indigo-200">
                0
              </div>

              <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">
                {items.length === 0 ? "No inventory items yet" : "No items found"}
              </h2>

              <p className="max-w-md text-lg text-slate-400">
                {items.length === 0
                  ? "Add your first product to start tracking stock, categories, and item details."
                  : "No products match the current search."}
              </p>

              {items.length === 0 ? (
                <Link
                  href="/dashboard/add-item"
                  className="mt-6 rounded-2xl bg-white px-5 py-3 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200"
                >
                  Add your first item
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-6 rounded-2xl bg-white px-5 py-3 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#02030a]/80 p-4 backdrop-blur-xl">
          <div className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#080b18]/90 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-7 md:p-9">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  New product
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Add Item</h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isAdding) return;
                  setIsModalOpen(false);
                  setAddError("");
                }}
                disabled={isAdding}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-2 text-slate-400 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-50"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddItem} className="flex flex-col gap-5 sm:gap-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">Product Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[110px] w-full resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">Upload Image</label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImage(e.target.files?.[0] || null)}
                    className="w-full cursor-pointer text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-200 transition-colors hover:file:bg-indigo-500/30"
                  />
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                {addError && (
                  <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-200">
                    <p>{addError}</p>

                    {isLimitError && (
                      <Link
                        href="/request-plan"
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-slate-200"
                      >
                        Request a plan
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    if (isAdding) return;
                    setIsModalOpen(false);
                    setAddError("");
                  }}
                  disabled={isAdding}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] py-4 text-base font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 rounded-2xl bg-white py-4 text-base font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
                >
                  {isAdding ? "Saving..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#02030a]/80 p-4 backdrop-blur-xl">
          <div className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#080b18]/90 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-7 md:p-9">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Product details
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Edit Item</h2>

                <p className="mt-2 text-slate-400">
                  Update product details and replace the image if needed.
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeEditModal()}
                disabled={isEditing}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-2 text-slate-400 transition hover:bg-white/[0.09] hover:text-white disabled:opacity-50"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">SKU</label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-400">Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="min-h-[110px] w-full resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">Replace Image</label>
                <div className="grid grid-cols-1 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 md:grid-cols-[140px_1fr]">
                  {selectedItem.image ? (
                    <div className="relative h-[120px] overflow-hidden rounded-2xl bg-[#f4f0e8] p-3">
                      <Image
                        src={selectedItem.image}
                        alt={selectedItem.name}
                        fill
                        loading="lazy"
                        sizes="120px"
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
