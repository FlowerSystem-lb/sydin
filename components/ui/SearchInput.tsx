"use client";

import UiIcon from "@/components/UiIcon";
import { cx } from "./utils";

/**
 * The one search box.
 *
 * There were seven of these, hand-written, and the differences were not
 * decisions -- they were drift. Two focus colours (`#2563eb` on most pages,
 * `cyan-300` on QR Center), two ways of drawing the same focus ring
 * (`focus:ring-4` on five, `focus:shadow-[0_0_0_4px_...]` on one), two radii
 * (`rounded-xl` everywhere, `rounded-2xl` on Activity), some with a minimum
 * height and some without, some with room for the icon and some with the icon
 * missing entirely. Every new page copied whichever one it happened to sit
 * next to, so the set grew.
 *
 * Two things this fixes beyond looks:
 *
 * - **A name.** Activity's box had a placeholder and nothing else. A
 *   placeholder is not an accessible name: it disappears the moment you type,
 *   and it is not reliably announced. `label` is required here, so a search
 *   box cannot be added without one; pass `labelHidden` (the default) to keep
 *   it visually silent, exactly as the good pages already did with `sr-only`.
 * - **A way out.** `type="search"` renders a clear button in some browsers and
 *   not others, so on half the pages a typed query could only be removed by
 *   selecting it and deleting. This draws its own, everywhere.
 */
export default function SearchInput({
  label,
  labelHidden = true,
  value,
  onChange,
  placeholder,
  id,
  className,
  inputClassName,
  autoFocus,
  disabled,
}: {
  /** Required: the accessible name. Hidden by default, never absent. */
  label: string;
  labelHidden?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  /** Width and placement belong to the page, not to the control. */
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={cx("ui-search", className)}>
      <span className={labelHidden ? "sr-only" : "ui-search-label"}>
        {label}
      </span>

      <span className="ui-search-field">
        <UiIcon name="search" className="ui-search-icon h-4 w-4" />

        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cx("ui-search-input", inputClassName)}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="ui-search-clear"
            aria-label={`Clear ${label.toLowerCase()}`}
            title="Clear"
          >
            <UiIcon name="close" className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </label>
  );
}
