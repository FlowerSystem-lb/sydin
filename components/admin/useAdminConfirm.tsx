"use client";

import { useCallback, useRef, useState } from "react";

/* "Are you sure?" for the admin console, drawn by SydIN itself.
 *
 * Was window.confirm(): browsers (Opera, Chrome) offer "don't let this site
 * show more dialogs" after a few, and from then on confirm() silently returns
 * false -- Delete, Reject and Cancel just did nothing (30 Sep 2026). A page
 * dialog can't be blocked. Usage:
 *
 *   const { confirm, confirmDialog } = useAdminConfirm();
 *   if (!(await confirm({ title: "Delete?", danger: true }))) return;
 *   ...  {confirmDialog}  in the JSX
 */

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function useAdminConfirm() {
  const [open, setOpen] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpen(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(null);
  };

  const confirmDialog = open ? (
    <div
      className="ad-confirm-backdrop"
      role="presentation"
      onClick={() => answer(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") answer(false);
      }}
    >
      <div
        className="ad-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ad-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="ad-confirm-title">{open.title}</h2>
        {open.body && <p>{open.body}</p>}
        <div className="ad-confirm-actions">
          <button type="button" className="ad-btn ad-btn-ghost" onClick={() => answer(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={`ad-btn ${open.danger ? "ad-btn-danger-solid" : "ad-btn-primary"}`}
            onClick={() => answer(true)}
            autoFocus
          >
            {open.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmDialog };
}
