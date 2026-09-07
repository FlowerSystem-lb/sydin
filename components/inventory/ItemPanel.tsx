"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The slide-over shell Add Item and Edit Item both open inside, on every
 * page that opens either one (Inventory, and the item detail page's own
 * Edit). One shell instead of three copies of the same overlay/header/close
 * button markup drifting slightly apart from each other -- which is exactly
 * what had happened before this: Inventory's version and the detail page's
 * version already disagreed on a border color and a shadow.
 *
 * Deliberately thin: it owns the overlay, the slide-in panel, the header and
 * the scrollable body. It does NOT own the footer (Cancel/Save) -- that
 * stays inside AddItemForm/EditItemForm themselves, next to the loading
 * state and validation it's already wired to.
 */
export default function ItemPanel({
  eyebrow,
  title,
  onClose,
  closeDisabled,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
}) {
  // `.dashboard-shell` sets `isolation: isolate` for its own reasons (see
  // that rule in globals.css) -- which, as a side effect, traps any
  // `position: fixed` descendant inside its own stacking context. No z-index
  // in here can then out-rank `.mobile-shell-nav`, which lives outside that
  // boundary and was rendering on top of this panel's footer regardless of
  // what z-index this carried. A portal straight to `document.body` is how
  // every other full-screen overlay in this codebase (ItemDetailsSlideOver,
  // Overlay, ImageLightbox) already avoids the same trap.
  const panel = (
    <div
      className="item-panel-overlay"
      onMouseDown={(event) => {
        // Only a direct click on the backdrop closes it -- a drag that
        // starts inside the panel and ends outside it (selecting text,
        // say) must not be read as "close this".
        if (event.target === event.currentTarget && !closeDisabled) {
          onClose();
        }
      }}
    >
      <aside
        className="item-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="item-panel-chrome">
          <div className="min-w-0">
            <p className="item-panel-eyebrow">{eyebrow}</p>
            <h2 className="item-panel-chrome-title">{title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close"
            className="item-panel-close disabled:pointer-events-none disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="item-panel-scroll">{children}</div>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(panel, document.body);
}
