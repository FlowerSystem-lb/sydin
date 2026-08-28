"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import IconButton from "@/components/ui/IconButton";
import UiIcon from "@/components/UiIcon";
import { cx } from "@/components/ui/utils";

/**
 * Every overlay in SydIN renders through `document.body`, not where it was
 * written in the tree.
 *
 * Sayed's note, 27 Aug 2026: "Adjust of item on Card, it is open like half hide
 * and I need to scroll Down or up to make it fit to screen" and "there is bugs
 * of blur in page Right and left Side of page when click adjust". Those are one
 * bug, not two.
 *
 * `.ui-overlay` is `position: fixed; inset: 0`, which should mean the viewport.
 * But an element with a `backdrop-filter` other than `none` becomes the
 * containing block for fixed-position descendants, and `.dashboard-shell`,
 * `.dashboard-main-canvas` and `.inventory-workspace` all set one. The dialog
 * was rendered inside them, so `inset: 0` resolved to the content area instead:
 * the backdrop stopped short of the sidebar and the right gutter (the blur down
 * the page edges), and the dialog's `max-height: calc(100vh - 6rem)` was
 * measured against the real viewport while its scroll container was the smaller
 * content box — so a tall dialog overflowed a centred flex container, and the
 * part that overflows upward cannot be scrolled to. Hence "half hidden".
 *
 * This is the second time this containing-block rule has caught us; the sidebar
 * name chip vanished for the same reason and it is recorded in the decision log.
 * A portal fixes it at the root for every dialog and sheet at once.
 *
 * Client guard: `document` does not exist while rendering on the server, and
 * returning a different tree on the server than on the first client render
 * would break hydration. `useSyncExternalStore` is the sanctioned way to ask
 * "am I on the client yet?" — it returns the server snapshot (false) during SSR
 * and the first client render, then the client snapshot (true) immediately
 * after. Setting state from an effect would do the same job but React 19's
 * lint rules reject it, and rightly: it renders twice for no reason.
 */
const subscribeToNothing = () => () => {};

function useOverlayPortal(open: boolean) {
  const isClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );

  return open && isClient ? document.body : null;
}

interface DialogShellProps {
  open?: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  className?: string;
  tone?: "default" | "danger";
}

export function DialogShell({
  open = true,
  title,
  description,
  eyebrow,
  children,
  footer,
  onClose,
  closeDisabled = false,
  className,
  tone = "default",
}: DialogShellProps) {
  const generatedId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const portalTarget = useOverlayPortal(open);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDisabled, onClose, open]);

  if (!open || !portalTarget) return null;

  const titleId = `${generatedId}-title`;
  const descriptionId = description ? `${generatedId}-description` : undefined;

  return createPortal(
    <div
      className="ui-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cx(
          "ui-dialog glass-overlay",
          tone === "danger" && "ui-dialog-danger",
          className
        )}
      >
        <div className="ui-dialog-header">
          <div className="min-w-0">
            {eyebrow && (
              <p className={tone === "danger" ? "ui-eyebrow-danger" : "ui-eyebrow"}>
                {eyebrow}
              </p>
            )}
            <h2 id={titleId} className="ui-dialog-title">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="ui-dialog-description">
                {description}
              </p>
            )}
          </div>
          <IconButton
            label="Close dialog"
            icon={<UiIcon name="close" className="h-5 w-5" />}
            onClick={onClose}
            disabled={closeDisabled}
          />
        </div>
        {children && <div className="ui-dialog-body">{children}</div>}
        {footer && <div className="ui-dialog-footer">{footer}</div>}
      </div>
    </div>,
    portalTarget
  );
}

interface SheetShellProps extends Omit<DialogShellProps, "tone"> {
  side?: "left" | "right" | "bottom";
}

export function SheetShell({
  side = "right",
  open = true,
  title,
  description,
  eyebrow,
  children,
  footer,
  onClose,
  closeDisabled = false,
  className,
}: SheetShellProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const portalTarget = useOverlayPortal(open);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      sheetRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDisabled, onClose, open]);

  if (!open || !portalTarget) return null;

  return createPortal(
    <div className="ui-overlay">
      <aside
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx("ui-sheet glass-overlay", `ui-sheet-${side}`, className)}
      >
        <div className="ui-dialog-header">
          <div className="min-w-0">
            {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
            <h2 className="ui-dialog-title">{title}</h2>
            {description && <p className="ui-dialog-description">{description}</p>}
          </div>
          <IconButton
            label="Close sheet"
            icon={<UiIcon name="close" className="h-5 w-5" />}
            onClick={onClose}
            disabled={closeDisabled}
          />
        </div>
        <div className="ui-sheet-body">{children}</div>
        {footer && <div className="ui-dialog-footer">{footer}</div>}
      </aside>
    </div>,
    portalTarget
  );
}

export function MenuSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="menu" className={cx("ui-menu-surface glass-control", className)}>
      {children}
    </div>
  );
}
