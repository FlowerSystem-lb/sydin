"use client";

import Link from "next/link";
import type { Category } from "@/app/lib/categories";
import Select from "@/components/ui/Select";

interface CategorySelectorProps {
  categories: Category[];
  value: string;
  legacyCategory?: string | null;
  disabled?: boolean;
  onChange: (categoryId: string) => void;
  className?: string;
  id?: string;
  /** Create a category from the dropdown; returns the new id to select. */
  onCreate?: (name: string) => Promise<string | null>;
  /**
   * Drops the "Categories are managed separately / Manage Categories" footer.
   * Inside the item panel that line is both noise and wrong advice -- with
   * `onCreate` wired up, categories are no longer managed only elsewhere.
   */
  compact?: boolean;
}

export default function CategorySelector({
  categories,
  value,
  legacyCategory,
  disabled = false,
  onChange,
  className = "",
  id,
  onCreate,
  compact = false,
}: CategorySelectorProps) {
  const hasLegacyCategory =
    value === "legacy" && Boolean(legacyCategory?.trim());
  const options = [
    { value: "", label: "No category" },
    ...(hasLegacyCategory
      ? [
          {
            value: "legacy",
            label: `Legacy: ${legacyCategory?.trim()}`,
          },
        ]
      : []),
    ...categories.map((category) => ({
      value: String(category.id),
      label: category.name,
      description: category.description || undefined,
    })),
  ];

  return (
    <div className={className}>
      <Select
        id={id}
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel="Category"
        placeholder="No category"
        searchable={categories.length > 8}
        searchPlaceholder="Search categories"
        disabled={disabled}
        onCreate={onCreate}
        createNoun={onCreate ? "category" : undefined}
        buttonClassName={
          compact ? undefined : "min-h-14 rounded-2xl px-5 text-base"
        }
      />
      {hasLegacyCategory && (
        <p className="mt-2 rounded-xl border border-amber-300/15 bg-amber-500/[0.07] px-3 py-2 text-xs leading-5 text-theme-warning">
          Existing legacy category: <strong>{legacyCategory?.trim()}</strong>.
          Select a managed category or choose No category to clear it.
        </p>
      )}
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-theme-subtle">
          <span>Optional. Categories are managed separately.</span>
          <Link
            href="/dashboard/categories"
            className="font-bold text-theme-accent transition hover:text-theme-primary"
          >
            Manage Categories
          </Link>
        </div>
      )}
    </div>
  );
}
