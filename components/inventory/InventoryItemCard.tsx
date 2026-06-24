"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
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
  supplierLabel,
  lowStock,
  stockStatusLabel,
  stockStatusTone = lowStock ? "warning" : "success",
  deleting,
  selectable = false,
  selected = false,
  onAdjust,
  onEdit,
  onDelete,
  onToggleSelected,
  onOpenDetails,
  onHistory,
  onCreateQrLabel,
  detailsHref,
}: {
  item: CompactInventoryItem;
  itemCode?: string | null;
  quantityLabel: string;
  categoryLabel: string;
  depotLabel?: string | null;
  supplierLabel?: string | null;
  lowStock: boolean;
  stockStatusLabel?: string;
  stockStatusTone?: "success" | "warning" | "danger";
  deleting: boolean;
  selectable?: boolean;
  selected?: boolean;
  onAdjust: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSelected?: () => void;
  onOpenDetails?: () => void;
  onHistory?: () => void;
  onCreateQrLabel?: () => void;
  detailsHref?: string;
}) {
  const router = useRouter();
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const resolvedDetailsHref =
    detailsHref || `/dashboard/inventory/${item.id}`;
  const showImage = Boolean(item.image) && failedImageSrc !== item.image;
  const statusClassName =
    stockStatusTone === "danger"
      ? "border-red-200 bg-red-50 text-red-600"
      : stockStatusTone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const openDetails = useCallback(() => {
    if (selectable) {
      onToggleSelected?.();
      return;
    }

    if (onOpenDetails) {
      onOpenDetails();
      return;
    }

    router.push(resolvedDetailsHref);
  }, [onOpenDetails, onToggleSelected, resolvedDetailsHref, router, selectable]);

  const positionMenu = useCallback(() => {
    const trigger = menuButtonRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 232;
    const menuHeight = 292;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(rect.right - menuWidth, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding
    );
    const wouldClipBottom =
      rect.bottom + menuHeight + viewportPadding > window.innerHeight;
    const top = wouldClipBottom
      ? Math.max(viewportPadding, rect.top - menuHeight - 8)
      : rect.bottom + 8;

    setMenuStyle({
      left,
      top,
      width: menuWidth,
    });
  }, []);

  const toggleMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    positionMenu();
    setMenuOpen((current) => !current);
  };

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const runMenuAction = (action: () => void) => {
    closeMenu();
    action();
  };

  useEffect(() => {
    if (!menuOpen) return;

    positionMenu();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      if (
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }

      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [closeMenu, menuOpen, positionMenu]);

  return (
    <article
      role={selectable ? "checkbox" : "button"}
      tabIndex={0}
      aria-label={`View ${item.name}`}
      aria-checked={selectable ? selected : undefined}
      onClick={openDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      }}
      className={`group relative min-w-0 cursor-pointer overflow-visible rounded-2xl border bg-theme-surface shadow-[0_6px_18px_rgba(15,23,42,0.055)] transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300/40 hover:shadow-[0_10px_24px_rgba(67,56,202,0.1)] active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/20 motion-reduce:transform-none ${
        selectable && selected
          ? "border-cyan-300 bg-cyan-500/[0.08] ring-2 ring-cyan-300/35"
          : "border-theme"
      }`}
    >
      <div className="relative aspect-[5/3] overflow-hidden rounded-t-[15px] border-b border-theme bg-[#f5f7fb]">
        {selectable && (
          <label
            className="absolute left-2.5 top-2.5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition hover:bg-white focus-within:ring-4 focus-within:ring-cyan-300/25"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="sr-only">
              {selected ? "Deselect" : "Select"} {item.name}
            </span>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
            />
          </label>
        )}
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailedImageSrc(item.image)}
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-theme-subtle">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-200/60 bg-white text-theme-accent shadow-sm">
              <UiIcon name="box" className="h-5 w-5" />
            </span>
            <span className="mt-1 text-[10px] font-semibold">No image</span>
          </div>
        )}

        {lowStock && (
          <span className="absolute left-2.5 bottom-2.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600 shadow-sm">
            {stockStatusLabel || "Low stock"}
          </span>
        )}

        <button
          ref={menuButtonRef}
          type="button"
          aria-label={`Actions for ${item.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-item-actions={item.id}
          onClick={toggleMenu}
          onKeyDown={(event) => event.stopPropagation()}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-600 shadow-sm outline-none transition hover:bg-white hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-indigo-400/20"
        >
          <UiIcon name="more" className="h-4 w-4" />
        </button>

        {menuOpen &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={menuStyle}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              className="fixed z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_14px_34px_rgba(15,23,42,0.16)]"
            >
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenuAction(openDetails)}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              <UiIcon name="file" className="h-4 w-4" />
              View details
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenuAction(onAdjust)}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              <UiIcon name="movement" className="h-4 w-4" />
              Adjust stock
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenuAction(onEdit)}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              <UiIcon name="appearance" className="h-4 w-4" />
              Edit
            </button>
            {(onHistory || onCreateQrLabel) && (
              <div className="my-1 border-t border-slate-200" />
            )}
            {onHistory && (
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction(onHistory)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
              >
                <UiIcon name="clock" className="h-4 w-4" />
                Activity
              </button>
            )}
            {onCreateQrLabel && (
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction(onCreateQrLabel)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
              >
                <UiIcon name="qr" className="h-4 w-4" />
                Create QR / Label
              </button>
            )}
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              role="menuitem"
              onClick={() => runMenuAction(onDelete)}
              disabled={deleting}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UiIcon name="trash" className="h-4 w-4" />
              {deleting ? "Deleting..." : "Delete"}
            </button>
            </div>,
            document.body
          )}
      </div>

      <div className="p-2.5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-theme-accent">
              {itemCode || (item.sku ? `SKU ${item.sku}` : "Inventory item")}
            </p>
            <h2 className="mt-0.5 truncate text-[0.9rem] font-extrabold text-theme-primary" title={item.name}>
              {item.name}
            </h2>
          </div>
          <span className="max-w-[48%] shrink-0 rounded-lg border border-indigo-200/70 bg-indigo-50 px-2 py-0.5 text-right text-[10px] font-extrabold text-indigo-700">
            {quantityLabel}
          </span>
        </div>

        <div className="mt-1.5 flex min-h-6 flex-wrap gap-1">
          <span
            className={`max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClassName}`}
          >
            {stockStatusLabel || "In Stock"}
          </span>
          <span className="max-w-full truncate rounded-full border border-theme bg-theme-inset px-2 py-0.5 text-[10px] font-semibold text-theme-secondary">
            {categoryLabel}
          </span>
          {depotLabel && (
            <span className="max-w-full truncate rounded-full border border-cyan-200/70 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">
              {depotLabel}
            </span>
          )}
          {supplierLabel && (
            <span className="max-w-full truncate rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              {supplierLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
