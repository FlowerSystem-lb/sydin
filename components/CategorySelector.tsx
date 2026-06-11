"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category } from "@/app/lib/categories";

interface CategorySelectorProps {
  categories: Category[];
  value: string;
  legacyCategory?: string | null;
  disabled?: boolean;
  onChange: (categoryId: string) => void;
  className?: string;
  id?: string;
}

export default function CategorySelector({
  categories,
  value,
  legacyCategory,
  disabled = false,
  onChange,
  className = "",
  id,
}: CategorySelectorProps) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const visibleCategories = useMemo(
    () =>
      normalizedSearch
        ? categories.filter(
            (category) =>
              String(category.id) === value ||
              category.name.toLowerCase().includes(normalizedSearch)
          )
        : categories,
    [categories, normalizedSearch, value]
  );
  const hasLegacyCategory =
    value === "legacy" && Boolean(legacyCategory?.trim());

  return (
    <div className={className}>
      {categories.length > 8 && (
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={disabled}
          placeholder="Filter categories"
          className="mb-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
        />
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-2xl border border-white/10 bg-black/35 px-5 py-4 pr-12 text-base text-white outline-none transition focus:border-cyan-300/60 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.1)] disabled:opacity-60"
        >
          <option value="">No category</option>
          {hasLegacyCategory && (
            <option value="legacy">
              Legacy: {legacyCategory?.trim()}
            </option>
          )}
          {visibleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
      {hasLegacyCategory && (
        <p className="mt-2 rounded-xl border border-amber-300/15 bg-amber-500/[0.07] px-3 py-2 text-xs leading-5 text-amber-100">
          Existing legacy category: <strong>{legacyCategory?.trim()}</strong>.
          Select a managed category or choose No category to clear it.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Optional. Categories are managed separately.</span>
        <Link
          href="/dashboard/categories"
          className="font-bold text-cyan-200 transition hover:text-white"
        >
          Manage Categories
        </Link>
      </div>
    </div>
  );
}
