"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";

export interface CompactInventoryItem {
  id: number;
  name: string;
  image: string;
  sku?: string | null;
}

export default function InventoryItemCard({
  item,
  itemCode,
  quantityLabel,
  categoryLabel,
  depotLabel,
  lowStock,
  deleting,
  onEdit,
  onDelete,
}: {
  item: CompactInventoryItem;
  itemCode?: string | null;
  quantityLabel: string;
  categoryLabel: string;
  depotLabel?: string | null;
  lowStock: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const detailsHref = `/dashboard/inventory/${item.id}`;

  const openDetails = () => {
    router.push(detailsHref);
  };

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`View ${item.name}`}
      onClick={openDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      }}
      className="group relative min-w-0 cursor-pointer overflow-visible rounded-[22px] border border-theme bg-theme-surface shadow-[0_14px_36px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300/40 hover:shadow-[0_18px_42px_rgba(67,56,202,0.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/20"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-[21px] border-b border-theme bg-[#f5f7fb]">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            loading="lazy"
            sizes="(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-theme-subtle">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-200/60 bg-white text-theme-accent shadow-sm">
              <UiIcon name="box" className="h-5 w-5" />
            </span>
            <span className="mt-2 text-xs font-semibold">No image</span>
          </div>
        )}

        {lowStock && (
          <span className="absolute left-3 top-3 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600 shadow-sm">
            Low stock
          </span>
        )}

        <details
          className="group/menu absolute right-3 top-3"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <summary
            aria-label={`Actions for ${item.name}`}
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-600 shadow-sm outline-none transition hover:bg-white hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-indigo-400/20 [&::-webkit-details-marker]:hidden"
          >
            <UiIcon name="more" className="h-5 w-5" />
          </summary>
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={openDetails}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              <UiIcon name="file" className="h-4 w-4" />
              View details
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onEdit}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              <UiIcon name="appearance" className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onDelete}
              disabled={deleting}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UiIcon name="trash" className="h-4 w-4" />
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </details>
      </div>

      <div className="p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-theme-accent">
              {itemCode || (item.sku ? `SKU ${item.sku}` : "Inventory item")}
            </p>
            <h2 className="mt-1 truncate text-base font-extrabold tracking-tight text-theme-primary">
              {item.name}
            </h2>
          </div>
          <span className="max-w-[46%] shrink-0 rounded-xl border border-indigo-200/70 bg-indigo-50 px-2.5 py-1.5 text-right text-xs font-extrabold text-indigo-700">
            {quantityLabel}
          </span>
        </div>

        <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
          <span className="max-w-full truncate rounded-full border border-theme bg-theme-inset px-2.5 py-1 text-[11px] font-semibold text-theme-secondary">
            {categoryLabel}
          </span>
          {depotLabel && (
            <span className="max-w-full truncate rounded-full border border-cyan-200/70 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-800">
              {depotLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
