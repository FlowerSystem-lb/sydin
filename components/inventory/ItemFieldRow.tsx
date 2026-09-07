"use client";

import type { ReactNode } from "react";

/**
 * The row primitives both AddItemForm and EditItemForm build their fields
 * from -- a label/value line with a hairline above and below it, grouped
 * under a small caps heading, no card or border of its own. Shared so the
 * two forms can't drift the way the old boxed-section markup did between
 * them (and between this page and the item detail page's own copy).
 */

export function ItemFieldGroup({
  label,
  action,
  children,
}: {
  label?: string;
  /** A small trailing control next to the label -- e.g. the "Hide" button
   *  that collapses the optional-details group back down. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="item-field-group">
      {(label || action) && (
        <div className="flex items-center justify-between gap-3">
          {label && <p className="item-field-group-label">{label}</p>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function ItemFieldRow({
  label,
  htmlFor,
  required,
  error,
  errorId,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="item-field-row">
      <label htmlFor={htmlFor} className="item-field-row-label">
        {label}
        {required && <span className="text-theme-accent"> *</span>}
      </label>
      <div className="item-field-row-control">
        {children}
        {error && (
          <p
            id={errorId}
            className="mt-1 text-xs font-semibold text-theme-danger"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
