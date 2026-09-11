"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardToolbar,
  FilterBar,
  FilterChip,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import {
  Button,
  DialogShell,
  FieldGroup,
  FieldRow,
  ResultsAnnouncer,
  SearchInput,
} from "@/components/ui";
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

const statusLabels: Record<PickListStatus, string> = {
  draft: "Draft",
  preparing: "Preparing",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusClasses: Record<PickListStatus, string> = {
  draft: "border-slate-300/20 bg-slate-400/10 text-theme-muted",
  preparing: "border-sydin-blue/25 bg-sydin-blue/10 text-theme-accent",
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
  handoffCount,
  onChange,
  onCancel,
  onSubmit,
}: {
  values: PickListInput;
  error: string;
  saving: boolean;
  handoffCount: number;
  onChange: (field: keyof PickListInput, value: string) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const titleMissing = touched && !values.title.trim();
  const formId = "pick-list-create";

  /* The button stays enabled: a disabled button explains nothing. Pressing it
     with no title shows the message and puts the cursor back in the field. */
  const handleSubmit = (event: React.FormEvent) => {
    if (!values.title.trim()) {
      event.preventDefault();
      setTouched(true);
      titleRef.current?.focus();
      return;
    }
    onSubmit(event);
  };

  /* Was a hand-built overlay: no dialog role, no Escape, no focus move, and
     positioned inside the shell's backdrop-filter -- the same containing-block
     trap Overlay.tsx documents. The shared DialogShell fixes all four. The
     footer buttons live outside the <form>, so the submit points at it by id. */
  return (
    <DialogShell
      title="Create Pick List"
      eyebrow="Order preparation"
      description="Start with the order, event, or project details. Stock stays unchanged until completion."
      onClose={onCancel}
      closeDisabled={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={saving}
            loadingLabel="Creating..."
          >
            Create Pick List
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="item-form -mx-1">
        {error && (
          <div className="mx-5 mb-3">
            <DashboardNotice tone="danger">{error}</DashboardNotice>
          </div>
        )}

        {handoffCount > 0 && (
          <div className="mx-5 mb-3">
            <DashboardNotice tone="info">
              {handoffCount} selected Inventory item
              {handoffCount === 1 ? "" : "s"} will be added with quantity 1.
              Review quantities before picking; stock will not be deducted.
            </DashboardNotice>
          </div>
        )}

        <FieldGroup label="Order">
          <FieldRow label="Title" htmlFor="pick-list-title" required>
            <input
              id="pick-list-title"
              ref={titleRef}
              value={values.title}
              onChange={(event) => onChange("title", event.target.value)}
              disabled={saving}
              aria-invalid={titleMissing}
              aria-describedby={titleMissing ? "pick-list-title-error" : undefined}
              placeholder="e.g. Wedding setup - June 20"
            />
            {titleMissing && (
              <p
                id="pick-list-title-error"
                className="mt-1 text-xs font-semibold text-theme-danger"
              >
                A title is required.
              </p>
            )}
          </FieldRow>

          <FieldRow label="Customer" htmlFor="pick-list-customer">
            <input
              id="pick-list-customer"
              value={values.customer_name || ""}
              onChange={(event) => onChange("customer_name", event.target.value)}
              disabled={saving}
              placeholder="Optional"
            />
          </FieldRow>

          <FieldRow label="Due date" htmlFor="pick-list-due">
            <input
              id="pick-list-due"
              type="date"
              value={values.due_date || ""}
              onChange={(event) => onChange("due_date", event.target.value)}
              disabled={saving}
            />
          </FieldRow>
        </FieldGroup>

        <FieldGroup label="Notes">
          <textarea
            value={values.notes || ""}
            onChange={(event) => onChange("notes", event.target.value)}
            disabled={saving}
            placeholder="Optional preparation instructions"
            className="item-panel-textarea"
          />
        </FieldGroup>
      </form>
    </DialogShell>
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
        <DashboardPageShell>
          <DashboardPageHeader
            eyebrow="Order preparation"
            title="Pick Lists"
            description="Prepare orders, events, and projects without changing stock until the work is complete."
            actions={
              <ActionButton
                onClick={openCreateForm}
                disabled={loading || limitReached}
                icon="plus"
              >
                Create Pick List
              </ActionButton>
            }
          />

          {pageError && (
            <DashboardNotice tone="danger">{pageError}</DashboardNotice>
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

          <DashboardToolbar className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Was a hand-rolled search box with a caption above it and four
                bespoke chip buttons. Same shared search + chips as Sales and
                Customers; the chips carry aria-pressed so the active filter is
                announced. */}
            <SearchInput
              label="Search Pick Lists"
              value={search}
              onChange={setSearch}
              placeholder="Title or customer"
              className="w-full lg:max-w-sm"
            />
            <FilterBar label="Pick List status" className="lg:ml-auto">
              {filters.map((item) => (
                <FilterChip
                  key={item.id}
                  active={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </FilterChip>
              ))}
            </FilterBar>
            <p className="text-sm font-semibold text-theme-muted lg:whitespace-nowrap">
              {activeCount} / {pickListLimit ?? "Unlimited"} active
            </p>
          </DashboardToolbar>
          <ResultsAnnouncer count={visibleLists.length} noun="pick list" />

          {loading ? (
            <LoadingSkeletonGroup
              count={3}
              className="md:grid-cols-2 xl:grid-cols-3"
              itemClassName="min-h-72"
            />
          ) : visibleLists.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleLists.map((list) => {
                const progress = getProgress(list);

                return (
                  <Link
                    key={list.id}
                    href={`/dashboard/pick-lists/${list.id}`}
                    className="dashboard-card group flex min-h-72 flex-col transition hover:-translate-y-0.5 hover:border-sydin-blue/25"
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
                          className="h-full rounded-full bg-[linear-gradient(90deg,#10c4dc,#2563eb)]"
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
            <DashboardEmptyState
              icon="picklists"
              title="Create your first Pick List"
              description="Add the items needed for an order or event, track preparation, and create a pick sheet without changing inventory stock."
              action={
                limitReached ? undefined : (
                  <ActionButton onClick={openCreateForm} icon="plus">
                    Create Pick List
                  </ActionButton>
                )
              }
            />
          ) : (
            <DashboardEmptyState
              icon="search"
              title={
                search.trim()
                  ? "No matching Pick Lists"
                  : `No ${filter === "all" ? "" : `${filter} `}Pick Lists`
              }
              description={
                search.trim()
                  ? "Try another title or customer name."
                  : "Completed and cancelled lists are under their own tabs, or choose All."
              }
            />
          )}
        </DashboardPageShell>
      </main>

      {formOpen && (
        <PickListForm
          values={formValues}
          error={formError}
          saving={saving}
          handoffCount={selectedHandoffIds.length}
          onChange={(field, value) =>
            setFormValues((current) => ({ ...current, [field]: value }))
          }
          onCancel={closeCreateForm}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
