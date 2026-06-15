"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import UiIcon from "@/components/UiIcon";
import { cx } from "@/components/ui/utils";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  description?: string;
  className?: string;
  buttonClassName?: string;
  id?: string;
  leadingIcon?: ReactNode;
}

export default function Select({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  placeholder = "Select an option",
  searchable = false,
  searchPlaceholder = "Search options",
  clearable = false,
  clearLabel = "Clear selection",
  disabled = false,
  loading = false,
  error,
  description,
  className,
  buttonClassName,
  id,
  leadingIcon,
}: SelectProps) {
  const generatedId = useId();
  const controlId = id || `${generatedId}-select`;
  const listboxId = `${generatedId}-listbox`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const selectedOption = options.find((option) => option.value === value);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleOptions = useMemo(
    () =>
      normalizedSearch
        ? options.filter((option) =>
            [option.label, option.description, option.keywords]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(normalizedSearch)
          )
        : options,
    [normalizedSearch, options]
  );

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;

    const selectedIndex = visibleOptions.findIndex(
      (option) => option.value === value && !option.disabled
    );
    const firstEnabledIndex = visibleOptions.findIndex(
      (option) => !option.disabled
    );
    const frame = window.requestAnimationFrame(() => {
      setActiveIndex(
        selectedIndex >= 0 ? selectedIndex : Math.max(0, firstEnabledIndex)
      );
      if (searchable) searchRef.current?.focus();
    });

    const positionMenu = () => {
      const button = buttonRef.current;
      if (!button || window.innerWidth < 640) return;
      const rect = button.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const maxHeight = Math.min(360, window.innerHeight - 32);
      const openAbove = spaceBelow < 260 && rect.top > spaceBelow;
      setMenuStyle({
        position: "fixed",
        left: Math.max(16, Math.min(rect.left, window.innerWidth - rect.width - 16)),
        width: rect.width,
        maxHeight,
        top: openAbove ? undefined : rect.bottom + 6,
        bottom: openAbove ? window.innerHeight - rect.top + 6 : undefined,
      });
    };

    positionMenu();
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close();
      }
    };
    const handleResize = () => positionMenu();

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [open, searchable, value, visibleOptions]);

  const moveActive = (direction: 1 | -1) => {
    if (visibleOptions.length === 0) return;
    let next = activeIndex;
    for (let attempts = 0; attempts < visibleOptions.length; attempts += 1) {
      next = (next + direction + visibleOptions.length) % visibleOptions.length;
      if (!visibleOptions[next]?.disabled) {
        setActiveIndex(next);
        return;
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      buttonRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        moveActive(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && !open) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) choose(option);
    }
  };

  const menu = open
    ? createPortal(
        <>
          <div className="ui-select-mobile-overlay" aria-hidden="true" />
          <div
            ref={menuRef}
            className="ui-select-menu"
            style={menuStyle}
            onKeyDown={handleKeyDown}
          >
            <div className="ui-select-mobile-heading">
              <p>{label || ariaLabel || placeholder}</p>
              <button type="button" onClick={close} aria-label="Close options">
                <UiIcon name="close" className="h-5 w-5" />
              </button>
            </div>
            {searchable && (
              <label className="ui-select-search">
                <UiIcon name="search" className="h-4 w-4" />
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                />
              </label>
            )}
            <div
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel || label || placeholder}
              aria-activedescendant={
                visibleOptions[activeIndex]
                  ? `${listboxId}-option-${activeIndex}`
                  : undefined
              }
              className="ui-select-options"
            >
              {loading ? (
                <p className="ui-select-state">Loading options...</p>
              ) : visibleOptions.length > 0 ? (
                visibleOptions.map((option, index) => {
                  const selected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      id={`${listboxId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={option.disabled}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(option)}
                      className={cx(
                        "ui-select-option",
                        index === activeIndex && "ui-select-option-active",
                        selected && "ui-select-option-selected"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="ui-select-option-label">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="ui-select-option-description">
                            {option.description}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <UiIcon name="check" className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="ui-select-state">No matching options.</p>
              )}
            </div>
            {clearable && value && (
              <button
                type="button"
                className="ui-select-clear"
                onClick={() => {
                  onChange("");
                  close();
                }}
              >
                {clearLabel}
              </button>
            )}
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <div className={cx("ui-select", className)}>
      {label && (
        <label htmlFor={controlId} className="ui-form-label">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        id={controlId}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled || loading}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={cx(
          "ui-select-trigger",
          error && "ui-select-trigger-error",
          buttonClassName
        )}
      >
        {leadingIcon}
        <span
          className={cx(
            "min-w-0 flex-1 truncate text-left",
            !selectedOption && "text-theme-subtle"
          )}
        >
          {loading ? "Loading..." : selectedOption?.label || placeholder}
        </span>
        <UiIcon
          name={open ? "chevron-up" : "chevron-down"}
          className="h-4 w-4 shrink-0 text-theme-subtle"
        />
      </button>
      {(error || description) && (
        <p
          className={error ? "ui-form-error" : "ui-form-description"}
          role={error ? "alert" : undefined}
        >
          {error || description}
        </p>
      )}
      {menu}
    </div>
  );
}
