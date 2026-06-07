"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import UiIcon from "@/components/UiIcon";
import {
  formatDepotLabel,
  getActiveDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import { supabase } from "@/app/lib/supabase";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getPlanLimitMessage,
  getSubscriptionUsage,
  type SubscriptionUsage,
} from "@/app/lib/subscription";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getImageValidationError(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Choose a JPG, PNG, or WebP image.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "Image must be 5MB or smaller.";
  }

  return "";
}

function getImageExtension(file: File) {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensionByType[file.type] || "jpg";
}

function createImagePath(userId: string, file: File) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);

  return `${userId}/${Date.now()}-${random}.${getImageExtension(file)}`;
}

export default function AddItemPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [selectedDepotId, setSelectedDepotId] = useState("");
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [isLimitError, setIsLimitError] = useState(false);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setUsageLoading(false);
          return;
        }

        Promise.all([
          getSubscriptionUsage(user.id),
          getActiveDepotsForUser(user.id).catch(() => []),
        ])
          .then(([usage, loadedDepots]) => {
            if (!isActive) return;

            setSubscriptionUsage(usage);
            setDepots(loadedDepots);
            setUsageLoading(false);
          })
          .catch(() => {
            if (!isActive) return;

            setUsageLoading(false);
          });
      })
      .catch(() => {
        if (!isActive) return;

        setUsageLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const imagePreviewUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : ""),
    [image]
  );

  useEffect(() => {
    if (!imagePreviewUrl) return;

    return () => {
      URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const handleImageChange = (file: File | null) => {
    setImageError("");

    if (!file) {
      setImage(null);
      return;
    }

    const validationError = getImageValidationError(file);

    if (validationError) {
      setImage(null);
      setImageError(validationError);
      return;
    }

    setImage(file);
  };

  const clearImage = () => {
    setImage(null);
    setImageError("");
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (loading) return;

    setIsLimitError(false);

    const trimmedName = name.trim();
    const quantityValue = Number(quantity);

    if (!trimmedName) {
      setFormError("Add a product name before saving.");
      return;
    }

    if (
      quantity === "" ||
      Number.isNaN(quantityValue) ||
      quantityValue < 0
    ) {
      setFormError("Enter a quantity of 0 or more before saving.");
      return;
    }

    try {
      setLoading(true);
      setFormError("");
      setImageError("");
      setIsLimitError(false);

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setFormError("Please sign in again before adding inventory.");
        return;
      }

      const usage = await getSubscriptionUsage(user.id, {
        strictCount: true,
      });
      setSubscriptionUsage(usage);

      if (usage.usedItems >= usage.subscription.item_limit) {
        setFormError(getPlanLimitMessage(usage.subscription.plan));
        setIsLimitError(true);
        return;
      }

      let imageUrl = "";

      if (image) {
        const validationError = getImageValidationError(image);

        if (validationError) {
          setImageError(validationError);
          return;
        }

        const fileName = createImagePath(user.id, image);

        const {
          error: uploadError,
        } = await supabase.storage
          .from("products")
          .upload(fileName, image);

        if (uploadError) {
          setFormError(
            "Image upload failed. Try a smaller file or a different image."
          );
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
        depot_id: selectedDepotId ? Number(selectedDepotId) : null,
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
        setFormError("We could not save this item. Please try again.");
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
      setFormError(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving this item."
      );
    } finally {
      setLoading(false);
    }
  };

  const currentPlanName = formatPlanName(subscriptionUsage.subscription.plan);
  const itemUsageText = `${subscriptionUsage.usedItems} / ${subscriptionUsage.subscription.item_limit} items`;

  return (
    <div className="liquid-bg min-h-screen overflow-x-hidden text-white">
      <Sidebar
        planName={currentPlanName}
        itemUsage={usageLoading ? "... / ... items" : itemUsageText}
      />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  New product
                </p>

                <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Add Item
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:mt-4 sm:text-lg sm:leading-7">
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
            aria-busy={loading}
            className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-7 lg:p-8"
          >
            <div className="mb-6 rounded-3xl border border-indigo-300/20 bg-indigo-500/10 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
                    Current plan
                  </p>

                  <p className="mt-1 text-2xl font-black text-white">
                    {usageLoading ? (
                      <span className="block h-8 w-28 animate-pulse rounded-2xl bg-white/[0.08]" />
                    ) : (
                      currentPlanName
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-black text-white">
                  {usageLoading ? "Checking usage..." : itemUsageText}
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="order-1 md:order-3 md:mt-5">
                <label className="mb-2 block text-sm font-semibold text-slate-400">
                  Product Image
                </label>

                <div className="rounded-3xl border border-dashed border-indigo-300/25 bg-black/30 p-4 transition hover:border-indigo-300/45 hover:bg-black/40 sm:p-5">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr] lg:items-center">
                    <label className="group flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.05] px-5 py-6 text-center transition hover:border-indigo-300/45 hover:bg-white/[0.08]">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-500/20 text-indigo-100 transition group-hover:bg-indigo-500/30">
                        <UiIcon name="upload" className="h-7 w-7" />
                      </span>

                      <span className="mt-4 text-lg font-black text-white">
                        Take or upload photo
                      </span>

                      <span className="mt-2 max-w-[220px] text-sm leading-5 text-slate-400">
                        JPG, PNG, or WebP up to 5MB.
                      </span>

                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) =>
                          handleImageChange(e.target.files?.[0] || null)
                        }
                        className="sr-only"
                      />
                    </label>

                    <div className="min-h-[190px] rounded-3xl border border-white/10 bg-black/25 p-4">
                      {image && imagePreviewUrl ? (
                        <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
                          <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#f4f0e8]">
                            <Image
                              src={imagePreviewUrl}
                              alt="Selected product preview"
                              fill
                              unoptimized
                              sizes="140px"
                              className="object-contain p-3"
                            />
                          </div>

                          <div>
                            <p className="text-sm font-bold uppercase tracking-[0.16em] text-indigo-200">
                              Selected image
                            </p>

                            <p className="mt-2 break-words text-base font-semibold text-white">
                              {image.name}
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                              {formatFileSize(image.size)}
                            </p>

                            <button
                              type="button"
                              onClick={clearImage}
                              disabled={loading}
                              className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Remove image
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[158px] flex-col justify-center rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-5">
                          <p className="text-base font-semibold text-white">
                            No image selected
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            JPG, PNG, or WebP. Maximum size 5MB.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {imageError && (
                    <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
                      {imageError}
                    </p>
                  )}
                </div>
              </div>

              <div className="order-2 mt-5 grid grid-cols-1 gap-5 md:order-1 md:mt-0 md:grid-cols-2">
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
                  Quantity
                </label>

                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={quantity}
                  onKeyDown={(e) => {
                    if (["-", "+", "e", "E"].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) =>
                    setQuantity(
                      e.target.value.startsWith("-") ? "" : e.target.value
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

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-400">
                  Depot
                </label>

                <select
                  value={selectedDepotId}
                  onChange={(e) => setSelectedDepotId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                >
                  <option value="">Unassigned</option>
                  {depots.map((depot) => (
                    <option
                      key={depot.id}
                      value={depot.id}
                    >
                      {formatDepotLabel(depot)}
                    </option>
                  ))}
                </select>
              </div>
              </div>

            <div className="order-3 mt-5 md:order-2">
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
            </div>

            {formError && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-200">
                <p>{formError}</p>

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

            <div className="sticky bottom-0 z-10 -mx-5 mt-7 flex flex-col-reverse gap-3 border-t border-white/10 bg-[#050713]/95 px-5 py-4 backdrop-blur-xl sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
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
                  ? "Saving item..."
                  : "Save Item"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
