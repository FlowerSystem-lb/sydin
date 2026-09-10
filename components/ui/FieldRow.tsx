"use client";

import type { ReactNode } from "react";

/**
 * The label/value row every record form in SydIN is built from: label on the
 * left, control on the right, a hairline between rows, grouped under a small
 * caps heading with no card or border of its own.
 *
 * Started life in components/inventory/ as the item panel's own markup, then
 * the invoice used it, and now the Customer/Supplier/Depot dialogs do -- at
 * which point living under `inventory/` was just wrong. Moved here so a
 * Customers page importing it doesn't have to reach into an inventory
 * folder to lay out a phone number.
 *
 * The CSS class names still read `item-*` (see globals.css). Renaming ~20
 * selectors across a 23k-line stylesheet to match the component's new home
 * is churn with a real chance of missing one, and this file is the thing
 * people actually read. The prefix is history, not scope.
 */

export function FieldGroup({
  label,
  description,
  action,
  children,
}: {
  label?: string;
  /** One line under the heading, for behaviour the fields cannot show on
   *  their own -- "the number is generated automatically", "this appears on
   *  the PDF". Not for restating the heading in a sentence. */
  description?: string;
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
      {description && <p className="item-field-group-note">{description}</p>}
      {children}
    </div>
  );
}

export function FieldRow({
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
