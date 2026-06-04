"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/app/lib/supabase";

interface Item {
  id: number;
  name: string;
  category: string;
  quantity: number;
  image: string;
  sku?: string;
  notes?: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
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

  const fetchItems = async () => {
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) return;

    const { data, error } =
      await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user.id)
        .order("id", {
          ascending: false,
        });

    if (error) {
      console.log(error);
      return;
    }

    setItems(data || []);
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user.id)
        .order("id", {
          ascending: false,
        })
        .then(({ data, error }) => {
          if (!isActive) return;

          if (error) {
            console.log(error);
            return;
          }

          setItems(data || []);
        });
    });

    return () => {
      isActive = false;
    };
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsAdding(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("Please login");
        setIsAdding(false);
        return;
      }

      let imageUrl = "";
      if (image) {
        const fileName = `${Date.now()}-${image.name}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, image);

        if (uploadError) {
          alert(uploadError.message);
          setIsAdding(false);
          return;
        }

        const { data } = supabase.storage.from("products").getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const { error } = await supabase.from("inventory").insert([{
        name,
        sku,
        category,
        quantity: Number(quantity),
        notes,
        image: imageUrl,
        user_id: user.id,
      }]);

      if (error) {
        alert(error.message);
        setIsAdding(false);
        return;
      }

      alert("Item added successfully");
      setIsModalOpen(false);
      setName("");
      setSku("");
      setCategory("");
      setQuantity("");
      setNotes("");
      setImage(null);
      fetchItems();
    } catch (error) {
      console.log(error);
      alert("Something went wrong");
    }
    setIsAdding(false);
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

      let imageUrl = selectedItem.image || "";

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

      const { data, error } = await supabase
        .from("inventory")
        .update({
          name: trimmedName,
          sku: editSku.trim(),
          category: editCategory.trim(),
          quantity: quantityValue,
          notes: editNotes,
          image: imageUrl,
        })
        .eq("id", selectedItem.id)
        .eq("user_id", user.id)
        .select("id");

      if (error) {
        setEditError(error.message);
        setIsEditing(false);
        return;
      }

      if (!data || data.length === 0) {
        setEditError("Item not found or you do not have access to update it.");
        setIsEditing(false);
        return;
      }

      await fetchItems();
      closeEditModal(true);
    } catch (error) {
      console.log(error);
      setEditError("Something went wrong while updating this item.");
    }

    setIsEditing(false);
  };

  const deleteItem = async (
    id: number
  ) => {
    const confirmDelete =
      confirm("Delete this item?");

    if (!confirmDelete) return;

    const { error } =
      await supabase
        .from("inventory")
        .delete()
        .eq("id", id);

    if (error) {
      alert("Error deleting item");
      return;
    }

    fetchItems();
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.22),_transparent_32%),radial-gradient(circle_at_80%_0%,_rgba(147,51,234,0.16),_transparent_28%),linear-gradient(135deg,_#02030a_0%,_#050713_48%,_#02030a_100%)] text-white">
      <Sidebar onAddItem={() => setIsModalOpen(true)} />

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
                  Search, edit, and manage every product in your SydIn workspace.
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="rounded-2xl bg-white px-5 py-4 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200"
              >
                Add Item
              </button>
            </div>
          </section>

          {/* Search */}
          <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-5">
            <label className="mb-3 block text-sm font-semibold text-slate-400">
              Search inventory
            </label>

            <input
              type="text"
              placeholder="Search by product or category..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
            />
          </section>

          {/* Items */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.055] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-1.5 hover:border-indigo-300/35 hover:bg-white/[0.075]"
              >
                {item.image ? (
                  <div className="flex h-[220px] w-full items-center justify-center overflow-hidden border-b border-white/10 bg-[#f4f0e8] p-4 md:h-[240px] xl:h-[250px]">
                    <div className="relative h-full w-full">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[220px] w-full items-center justify-center border-b border-white/10 bg-[#f4f0e8] text-base font-semibold text-slate-500 md:h-[240px] xl:h-[250px]">
                    No Image
                  </div>
                )}

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="break-words text-2xl font-bold tracking-tight text-white">
                        {item.name}
                      </h2>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.sku && (
                          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-300">
                            SKU {item.sku}
                          </span>
                        )}

                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-300">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-2xl border border-indigo-300/25 bg-indigo-500/15 px-3 py-2 text-lg font-black text-indigo-100">
                      {item.quantity}
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
                      onClick={() =>
                        openEditModal(
                          item
                        )
                      }
                      className="min-h-[52px] flex-1 rounded-2xl bg-white/90 py-3 text-base font-bold text-black transition hover:bg-white"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        deleteItem(
                          item.id
                        )
                      }
                      className="min-h-[52px] flex-1 rounded-2xl border border-red-400/25 bg-red-500/15 py-3 text-base font-bold text-red-200 transition hover:bg-red-500/25"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredItems.length ===
            0 && (
            <div className="mt-2 flex flex-col items-center justify-center rounded-[32px] border border-white/10 bg-white/[0.045] px-4 py-20 text-center shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-indigo-300/20 bg-indigo-500/15 text-2xl font-black text-indigo-200">
                0
              </div>

              <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">No items found</h2>

              <p className="max-w-md text-lg text-slate-400">
                Your inventory is empty or no products match the current search.
              </p>
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
                onClick={() => setIsModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-2 text-slate-400 transition hover:bg-white/[0.09] hover:text-white"
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
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] py-4 text-base font-bold text-white transition hover:bg-white/[0.1]"
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
                        className="object-contain p-3"
                      />
                    </div>
                  ) : (
                    <div className="flex h-[120px] items-center justify-center rounded-2xl bg-[#f4f0e8] text-slate-500">
                      No Image
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
