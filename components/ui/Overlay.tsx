"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import IconButton from "@/components/ui/IconButton";
import UiIcon from "@/components/UiIcon";
import { cx } from "@/components/ui/utils";

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

  if (!open) return null;

  const titleId = `${generatedId}-title`;
  const descriptionId = description ? `${generatedId}-description` : undefined;

  return (
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
    </div>
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

  if (!open) return null;

  return (
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
    </div>
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
