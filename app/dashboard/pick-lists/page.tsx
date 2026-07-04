"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WorkspaceHeader from "@/components/dashboard/WorkspaceHeader";
import { Button } from "@/components/ui";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  addPickListItem,
  createPickList,
  getPickListErrorMessage,
  getPickListsForUser,
  isPickListActive,
  type PickListInput,
  type PickListStatus,
  type PickListSummary,
} from "@/app/lib/pickLists";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionPickListLimit,
  getSubscriptionUsage,
  getUpgradePlanForPickListLimit,
  type SubscriptionUsage,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";

type PickListFilter = "active" | "completed" | "cancelled" | "all";

const EMPTY_FORM: PickListInput = {
  title: "",
  customer_name: "",
  due_date: "",
  notes: "",
};

const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

const inputClassName =
  "w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-4 py-3.5 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-cyan-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(34,211,238,0.1)] disabled:opacity-60";

const statusLabels: Record<PickListStatus, string> = {
  draft: "Draft",
  preparing: "Preparing",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusClasses: Record<PickListStatus, string> = {
  draft: "border-slate-300/20 bg-slate-400/10 text-slate-200",
  preparing: "border-cyan-300/25 bg-cyan-400/10 text-theme-accent",
  completed: "border-emerald-300/25 bg-emerald-400/10 text-theme-success",
  cancelled: "border-red-300/20 bg-red-400/10 text-theme-danger",
};

function formatDate(value: string | null) {
  if (!value) return "No due date";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getProgress(list: PickListSummary) {
  return list.required_total > 0
    ? Math.min(
        100,
        Math.round((list.prepared_total / list.required_total) * 100)
      )
    : 0;
}

function PickListForm({
  values,
  error,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  values: PickListInput;
  error: string;
  saving: boolean;
  onChange: (field: keyof PickListInput, value: string) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const [touched, setTouched] = useState(false);
  const titleMissing = touched && !values.title.trim();

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
            Order preparation
          </p>
          <h2 className="mt-2 text-3xl font-black text-theme-primary">
            Create Pick List
          </h2>
          <p className="mt-2 text-sm leading-6 text-theme-muted">
            Start with the order, event, or project details. Stock stays
            unchanged until completion.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          aria-label="Close create pick list form"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-theme bg-theme-surface text-xl text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary"
        >
          X
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Pick list title <span className="text-theme-accent">*</span>
          </label>
          <input
            autoFocus
            value={values.title}
            onBlur={() => setTouched(true)}
            onChange={(event) => onChange("title", event.target.value)}
            disabled={saving}
            aria-invalid={titleMissing}
            placeholder="e.g. Wedding setup - June 20"
            className={`${inputClassName} ${
              titleMissing ? "border-red-400/50 bg-red-500/[0.08]" : ""
            }`}
          />
          {titleMissing && (
            <p className="mt-2 text-sm font-semibold text-theme-danger">
              Pick list title is required.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Customer name
          </label>
          <input
            value={values.customer_name || ""}
            onChange={(event) => onChange("customer_name", event.target.value)}
            disabled={saving}
            placeholder="Optional"
            className={inputClassName}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Due / event date
          </label>
          <input
            type="date"
            value={values.due_date || ""}
            onChange={(event) => onChange("due_date", event.target.value)}
            disabled={saving}
            className={inputClassName}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Notes
          </label>
          <textarea
            value={values.notes || ""}
            onChange={(event) => onChange("notes", event.target.value)}
            disabled={saving}
            placeholder="Optional preparation instructions"
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
          disabled={saving || !values.title.trim()}
          className="glass-button px-6 py-3.5 font-bold disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Pick List"}
        </button>
      </div>
    </form>
  );
}

export default function PickListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<PickListSummary[]>([]);
  const [usage, setUsage] = useState<SubscriptionUsage>(DEFAULT_USAGE);
  const [userId, setUserId] = useState("");
  const [filter, setFilter] = useState<PickListFilter>("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<PickListInput>(EMPTY_FORM);
  const [selectedHandoffIds, setSelectedHandoffIds] = useState<number[]>([]);

  const loadLists = async (knownUserId: string) => {
    const [loadedLists, loadedUsage] = await Promise.all([
      getPickListsForUser(knownUserId),
      getSubscriptionUsage(knownUserId),
    ]);
    setLists(loadedLists);
    setUsage(loadedUsage);
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setPageError("Please sign in again to manage Pick Lists.");
          setLoading(false);
          return;
        }

        setUserId(user.id);

        try {
          const [loadedLists, loadedUsage] = await Promise.all([
            getPickListsForUser(user.id),
            getSubscriptionUsage(user.id),
          ]);
          if (!isActive) return;
          setLists(loadedLists);
          setUsage(loadedUsage);
        } catch (error) {
          if (!isActive) return;
          setPageError(getPickListErrorMessage(error));
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const requestedIds = new URLSearchParams(window.location.search)
        .get("items")
        ?.split(",")
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (!requestedIds?.length) return;
      setSelectedHandoffIds(requestedIds);
      setFormValues({
        ...EMPTY_FORM,
        title: "Selected inventory pick list",
        notes:
          "Created from selected Inventory items. Review quantities before picking.",
      });
      setFormOpen(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const activeCount = lists.filter((list) =>
    isPickListActive(list.status)
  ).length;
  const pickListLimit = getSubscriptionPickListLimit(usage.subscription);
  const limitReached =
    pickListLimit !== null && activeCount >= pickListLimit;
  const currentPlanName = formatPlanName(usage.subscription.plan);
  const requiredPlan = getUpgradePlanForPickListLimit(usage.subscription.plan);

  const visibleLists = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return lists.filter((list) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && isPickListActive(list.status)) ||
        list.status === filter;
      const matchesSearch =
        !normalizedSearch ||
        [list.title, list.customer_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [filter, lists, search]);

  const openCreateForm = () => {
    if (limitReached) return;
    setFormValues(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const closeCreateForm = () => {
    if (saving) return;
    setFormOpen(false);
    setFormValues(EMPTY_FORM);
    setFormError("");
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || saving || !formValues.title.trim()) return;

    try {
      setSaving(true);
      setFormError("");
      setPageError("");

      const created = await createPickList(
        userId,
        formValues,
        pickListLimit
      );

      if (selectedHandoffIds.length > 0) {
        for (const itemId of selectedHandoffIds) {
          await addPickListItem(userId, created.id, {
            inventoryItemId: itemId,
            requiredQuantity: 1,
            notes: "Added from Inventory selection. Adjust quantity as needed.",
          }).catch(() => undefined);
        }
      }

      router.push(`/dashboard/pick-lists/${created.id}`);
    } catch (error) {
      setFormError(getPickListErrorMessage(error));
      await loadLists(userId).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  };

  const filters: { id: PickListFilter; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="contents">
      <main className="operations-workspace operations-pick-lists">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-7">
          <WorkspaceHeader
            section="Operations"
            title="Pick Lists"
            description="Prepare orders, events, and projects without changing stock until the work is complete."
            actions={
              <Button
                onClick={openCreateForm}
                disabled={loading || limitReached}
              >
                Create Pick List
              </Button>
            }
          />

          {pageError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm font-semibold text-theme-danger"
            >
              {pageError}
            </div>
          )}

          {!loading && limitReached && pickListLimit !== null && (
            <LockedFeaturePanel
              feature={`${currentPlanName} active Pick List limit reached`}
              benefit={`${currentPlanName} includes ${pickListLimit} active Pick Lists. Existing lists remain editable and can be completed or cancelled. Completed and cancelled lists do not count toward the limit.`}
              currentPlan={currentPlanName}
              requiredPlan={requiredPlan}
              source="pick-list-limit"
              compact
            />
          )}

          <section className="glass-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-semibold text-theme-muted">
                  Search Pick Lists
                </label>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Title or customer"
                  className={inputClassName}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {filters.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      filter === item.id
                        ? "border-cyan-300/30 bg-cyan-400/15 text-theme-accent"
                        : "border-theme bg-theme-surface text-theme-muted hover:bg-theme-hover hover:text-theme-primary"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <p className="rounded-2xl border border-theme bg-theme-inset px-4 py-3 text-sm font-bold text-theme-secondary">
                {activeCount} / {pickListLimit ?? "Unlimited"} active
              </p>
            </div>
          </section>

          {selectedHandoffIds.length > 0 && formOpen && (
            <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-4 text-sm font-semibold text-theme-accent">
              {selectedHandoffIds.length} selected Inventory item
              {selectedHandoffIds.length === 1 ? "" : "s"} will be added with
              quantity 1. Review quantities before picking; stock will not be
              deducted.
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((key) => (
                <div key={key} className="glass-card h-72 animate-pulse" />
              ))}
            </div>
          ) : visibleLists.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleLists.map((list) => {
                const progress = getProgress(list);

                return (
                  <Link
                    key={list.id}
                    href={`/dashboard/pick-lists/${list.id}`}
                    className="glass-card group flex min-h-72 flex-col p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/25 sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="break-words text-2xl font-black text-theme-primary">
                          {list.title}
                        </h2>
                        <p className="mt-2 truncate text-sm font-semibold text-theme-muted">
                          {list.customer_name || "No customer name"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${statusClasses[list.status]}`}
                      >
                        {statusLabels[list.status]}
                      </span>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between gap-3 text-xs font-bold">
                        <span className="text-theme-muted">
                          {list.prepared_total} / {list.required_total} prepared
                        </span>
                        <span className="text-theme-accent">{progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-theme-surface">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-theme bg-theme-inset p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                          Due
                        </p>
                        <p className="mt-2 font-bold text-theme-primary">
                          {formatDate(list.due_date)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-theme bg-theme-inset p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                          Items
                        </p>
                        <p className="mt-2 font-bold text-theme-primary">
                          {list.item_count}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      {list.shortage_count > 0 &&
                      isPickListActive(list.status) ? (
                        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-theme-warning">
                          {list.shortage_count} stock shortage
                          {list.shortage_count === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-theme-subtle">
                          {list.item_count === 0
                            ? "Ready for items"
                            : "Stock available"}
                        </span>
                      )}
                      <span className="text-sm font-black text-theme-accent transition group-hover:translate-x-1">
                        Open
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : lists.length === 0 ? (
            <section className="glass-card px-5 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-2xl font-black text-theme-accent">
                +
              </div>
              <h2 className="mt-5 text-3xl font-black text-theme-primary">
                Create your first Pick List
              </h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-theme-muted">
                Add the items needed for an order or event, track preparation,
                and create a pick sheet without changing inventory stock.
              </p>
              {!limitReached && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="glass-button mt-6 px-6 py-3.5 font-bold"
                >
                  Create Pick List
                </button>
              )}
            </section>
          ) : (
            <section className="glass-card px-5 py-14 text-center">
              <h2 className="text-2xl font-black text-theme-primary">
                No matching Pick Lists
              </h2>
              <p className="mt-2 text-sm text-theme-subtle">
                Try another filter, title, or customer name.
              </p>
            </section>
          )}
        </div>
      </main>

      {formOpen && (
        <div className="operations-modal-overlay fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="glass-modal my-8 w-full max-w-2xl p-5 sm:p-7">
            <PickListForm
              values={formValues}
              error={formError}
              saving={saving}
              onChange={(field, value) =>
                setFormValues((current) => ({ ...current, [field]: value }))
              }
              onCancel={closeCreateForm}
              onSubmit={handleCreate}
            />
          </div>
        </div>
      )}
    </div>
  );
}
