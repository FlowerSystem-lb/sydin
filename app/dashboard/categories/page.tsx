"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  createCategory,
  deleteCategory,
  filterCategories,
  getCategoriesForUser,
  getCategoryErrorMessage,
  updateCategory,
  type Category,
  type CategoryInput,
} from "@/app/lib/categories";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionCategoryLimit,
  getSubscriptionUsage,
  getUpgradePlanForCategoryLimit,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";

const EMPTY_FORM: CategoryInput = { name: "", description: "" };
const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};
const inputClassName =
  "w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-4 py-3.5 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-cyan-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(34,211,238,0.1)] disabled:opacity-60";

function CategoryForm({
  editing,
  values,
  error,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  editing: boolean;
  values: CategoryInput;
  error: string;
  saving: boolean;
  onChange: (field: keyof CategoryInput, value: string) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const [touched, setTouched] = useState(false);
  const nameError = touched && !values.name.trim();

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
            {editing ? "Category details" : "New category"}
          </p>
          <h2 className="mt-2 text-3xl font-black text-theme-primary">
            {editing ? "Edit Category" : "Add Category"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          aria-label="Close category form"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-theme bg-theme-surface text-xl text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary"
        >
          X
        </button>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Category name <span className="text-theme-accent">*</span>
          </label>
          <input
            autoFocus
            value={values.name}
            onBlur={() => setTouched(true)}
            onChange={(event) => onChange("name", event.target.value)}
            disabled={saving}
            aria-invalid={nameError}
            placeholder="e.g. Flower Arrangements"
            className={`${inputClassName} ${
              nameError ? "border-red-400/50 bg-red-500/[0.08]" : ""
            }`}
          />
          {nameError && (
            <p className="mt-2 text-sm font-semibold text-theme-danger">
              Category name is required.
            </p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Description
          </label>
          <textarea
            value={values.description || ""}
            onChange={(event) => onChange("description", event.target.value)}
            disabled={saving}
            placeholder="Optional internal description"
            className={`${inputClassName} min-h-28 resize-y`}
          />
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-2xl border border-theme bg-theme-surface px-6 py-3.5 font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !values.name.trim()}
          className="rounded-2xl bg-white px-6 py-3.5 font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Category"}
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [usage, setUsage] = useState<SubscriptionUsage>(DEFAULT_USAGE);
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [formValues, setFormValues] = useState<CategoryInput>(EMPTY_FORM);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const loadCategories = async (knownUserId: string) => {
    const [loadedCategories, loadedUsage] = await Promise.all([
      getCategoriesForUser(knownUserId),
      getSubscriptionUsage(knownUserId),
    ]);
    setCategories(loadedCategories);
    setUsage(loadedUsage);
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!isActive) return;
        if (!user) {
          setPageError("Please sign in again to manage categories.");
          setLoading(false);
          return;
        }

        setUserId(user.id);

        try {
          const [loadedCategories, loadedUsage] = await Promise.all([
            getCategoriesForUser(user.id),
            getSubscriptionUsage(user.id),
          ]);
          if (!isActive) return;
          setCategories(loadedCategories);
          setUsage(loadedUsage);
        } catch (error) {
          if (!isActive) return;
          setPageError(getCategoryErrorMessage(error));
        } finally {
          if (isActive) setLoading(false);
        }
      })
      .catch(() => {
        if (!isActive) return;
        setPageError("We could not confirm your session. Please sign in again.");
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const categoryLimit = getSubscriptionCategoryLimit(usage.subscription);
  const limitReached = categories.length >= categoryLimit;
  const currentPlanName = formatPlanName(usage.subscription.plan);
  const requiredPlan = getUpgradePlanForCategoryLimit(usage.subscription.plan);
  const visibleCategories = useMemo(
    () => filterCategories(categories, search),
    [categories, search]
  );

  const openCreateForm = () => {
    setEditingCategory(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (category: Category) => {
    setEditingCategory(category);
    setFormValues({
      name: category.name,
      description: category.description || "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingCategory(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || saving || !formValues.name.trim()) return;

    try {
      setSaving(true);
      setFormError("");
      setPageError("");
      setPageNotice("");

      if (!editingCategory) {
        const [freshCategories, freshUsage] = await Promise.all([
          getCategoriesForUser(userId),
          getSubscriptionUsage(userId),
        ]);
        const freshLimit = getSubscriptionCategoryLimit(
          freshUsage.subscription
        );

        setCategories(freshCategories);
        setUsage(freshUsage);

        if (freshCategories.length >= freshLimit) {
          setFormError(
            `You reached the ${formatPlanName(
              freshUsage.subscription.plan
            )} plan limit of ${freshLimit} categories.`
          );
          return;
        }

        await createCategory(userId, formValues);
        setPageNotice("Category added successfully.");
      } else {
        await updateCategory(userId, editingCategory.id, formValues);
        setPageNotice("Category updated across linked inventory.");
      }

      setFormOpen(false);
      setEditingCategory(null);
      setFormValues(EMPTY_FORM);
      setFormError("");
      await loadCategories(userId);
    } catch (error) {
      setFormError(getCategoryErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || deletingId || !userId) return;

    try {
      setDeletingId(pendingDelete.id);
      setPageError("");
      await deleteCategory(userId, pendingDelete.id);
      setPendingDelete(null);
      setPageNotice(
        "Category deleted. Linked items are now uncategorized; no items were deleted."
      );
      await loadCategories(userId);
    } catch {
      setPageError("We could not delete this category. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="contents">
      <main>
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-7">
          <section className="glass-panel p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  Inventory organization
                </p>
                <h1 className="mt-2 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                  Categories
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-theme-muted sm:text-lg">
                  Keep item classification clean, searchable, and consistent.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard/inventory"
                  className="rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 text-center font-bold text-theme-primary transition hover:bg-theme-hover"
                >
                  Inventory
                </Link>
                <button
                  type="button"
                  onClick={openCreateForm}
                  disabled={loading || limitReached}
                  className="glass-button px-5 py-3.5 font-bold disabled:opacity-50"
                >
                  Add Category
                </button>
              </div>
            </div>
          </section>

          {(pageError || pageNotice) && (
            <div
              role={pageError ? "alert" : "status"}
              className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
                pageError
                  ? "border-red-400/25 bg-red-500/10 text-theme-danger"
                  : "border-emerald-400/25 bg-emerald-500/10 text-theme-success"
              }`}
            >
              {pageError || pageNotice}
            </div>
          )}

          {!loading && limitReached && (
            <LockedFeaturePanel
              feature={`${currentPlanName} category limit reached`}
              benefit={`${currentPlanName} includes up to ${categoryLimit} categories. Existing categories remain viewable, selectable, editable, and deletable.`}
              currentPlan={currentPlanName}
              requiredPlan={requiredPlan}
              source="category-limit"
              compact
            />
          )}

          <section className="glass-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-semibold text-theme-muted">
                  Search categories
                </label>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name or description"
                  className={inputClassName}
                />
              </div>
              <p className="rounded-2xl border border-theme bg-theme-inset px-4 py-3 text-sm font-bold text-theme-secondary">
                {categories.length} / {categoryLimit} categories
              </p>
            </div>
          </section>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((key) => (
                <div key={key} className="glass-card h-56 animate-pulse" />
              ))}
            </div>
          ) : visibleCategories.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleCategories.map((category) => (
                <article
                  key={category.id}
                  className="glass-card flex min-h-56 flex-col p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="break-words text-2xl font-black text-theme-primary">
                      {category.name}
                    </h2>
                    <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-theme-accent">
                      {category.item_count || 0} items
                    </span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-theme-muted">
                    {category.description || "No description"}
                  </p>
                  <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
                    <button
                      type="button"
                      onClick={() => openEditForm(category)}
                      className="rounded-xl border border-theme bg-theme-surface px-4 py-3 text-sm font-bold text-theme-primary transition hover:bg-theme-hover"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(category)}
                      className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-theme-danger transition hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <section className="glass-card px-5 py-16 text-center">
              <h2 className="text-2xl font-black text-theme-primary">
                Add your first category
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-theme-muted">
                Create a clean category list before assigning categories to
                inventory items.
              </p>
              <button
                type="button"
                onClick={openCreateForm}
                disabled={limitReached}
                className="glass-button mt-6 px-6 py-3.5 font-bold"
              >
                Add Category
              </button>
            </section>
          ) : (
            <section className="glass-card px-5 py-14 text-center">
              <h2 className="text-xl font-black text-theme-primary">No results</h2>
              <p className="mt-2 text-sm text-theme-subtle">
                Try a different category name or description.
              </p>
            </section>
          )}
        </div>
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="glass-modal my-8 w-full max-w-xl p-5 sm:p-7">
            <CategoryForm
              editing={Boolean(editingCategory)}
              values={formValues}
              error={formError}
              saving={saving}
              onChange={(field, value) =>
                setFormValues((current) => ({ ...current, [field]: value }))
              }
              onCancel={closeForm}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center theme-overlay p-4 backdrop-blur-xl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            className="glass-modal w-full max-w-md p-6 sm:p-7"
          >
            <p className="text-xs font-black uppercase tracking-[0.17em] text-red-300">
              Delete category
            </p>
            <h2
              id="delete-category-title"
              className="mt-3 break-words text-2xl font-black text-theme-primary"
            >
              Delete {pendingDelete.name}?
            </h2>
            <p className="mt-3 leading-7 text-theme-muted">
              {pendingDelete.item_count || 0} linked item
              {pendingDelete.item_count === 1 ? "" : "s"} will become
              uncategorized. Inventory items will not be deleted.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId !== null}
                className="flex-1 rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 font-bold text-theme-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deletingId !== null}
                className="flex-1 rounded-2xl border border-red-400/25 bg-red-500/20 px-5 py-3.5 font-bold text-theme-danger disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Delete Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
