"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import { supabase } from "@/app/lib/supabase";

export default function AddItemPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (loading) return;

    const trimmedName = name.trim();
    const quantityValue = Number(quantity);

    if (!trimmedName) {
      setFormError("Product name is required.");
      return;
    }

    if (
      quantity === "" ||
      Number.isNaN(quantityValue) ||
      quantityValue < 0
    ) {
      setFormError("Quantity must be 0 or more.");
      return;
    }

    try {
      setLoading(true);
      setFormError("");

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setFormError("Please login before adding inventory.");
        return;
      }

      let imageUrl = "";

      // Upload image
      if (image) {
        const fileName = `${Date.now()}-${image.name}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from("products")
          .upload(fileName, image);

        if (uploadError) {
          setFormError(uploadError.message);
          return;
        }

        const { data } =
          supabase.storage
            .from("products")
            .getPublicUrl(fileName);

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

      // Insert inventory item
      const { data: createdItem, error } =
        await supabase
          .from("inventory")
          .insert([newItem])
          .select("*")
          .single();

      if (error) {
        setFormError(error.message);
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

      router.push(
        "/dashboard/inventory"
      );
    } catch (error) {
      console.log(error);

      setFormError(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving this item."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.22),_transparent_32%),radial-gradient(circle_at_80%_0%,_rgba(147,51,234,0.16),_transparent_28%),linear-gradient(135deg,_#02030a_0%,_#050713_48%,_#02030a_100%)] text-white">
      <Sidebar />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  New product
                </p>

                <h1 className="mt-2 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Add Item
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                  Add a new product to your inventory.
                </p>
              </div>

              <Link
                href="/dashboard/inventory"
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center text-base font-bold text-white transition hover:border-white/20 hover:bg-white/[0.1]"
              >
                Back to Inventory
              </Link>
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-7 lg:p-8"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">
                  Product Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">
                  SKU
                </label>

                <input
                  type="text"
                  value={sku}
                  onChange={(e) =>
                    setSku(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">
                  Category
                </label>

                <input
                  type="text"
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-400">
                  Quantity
                </label>

                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                  required
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-slate-400">
                Notes
              </label>

              <textarea
                value={notes}
                onChange={(e) =>
                  setNotes(
                    e.target.value
                  )
                }
                className="min-h-[130px] w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
              />
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-slate-400">
                Product Image
              </label>

              <div className="rounded-3xl border border-dashed border-indigo-300/25 bg-black/30 p-5 transition hover:border-indigo-300/45 hover:bg-black/40">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">
                      Upload product image
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      PNG, JPG, or WebP works best.
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setImage(
                        e.target
                          .files?.[0] ||
                          null
                      )
                    }
                    className="w-full cursor-pointer text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-500/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-200 transition-colors hover:file:bg-indigo-500/30 sm:w-auto"
                  />
                </div>

                {image && (
                  <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-300">
                    Selected: {image.name}
                  </p>
                )}
              </div>
            </div>

            {formError && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-200">
                {formError}
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/dashboard/inventory"
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-4 text-center text-base font-bold text-white transition hover:bg-white/[0.1]"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-white px-7 py-4 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Saving..."
                  : "Save Item"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
