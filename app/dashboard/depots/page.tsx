"use client";

import { useEffect, useMemo, useState } from "react";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import UiIcon from "@/components/UiIcon";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  FilterBar,
  FilterChip,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { Button, DialogShell, FieldGroup, FieldRow } from "@/components/ui";
import {
  createDepot,
  deleteDepot,
  formatDepotLabel,
  getDepotsForUser,
  updateDepot,
  type Depot,
} from "@/app/lib/depots";
import { supabase } from "@/app/lib/supabase";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionDepotLimit,
  getSubscriptionUsage,
  getUpgradePlanForDepotLimit,
  type SubscriptionUsage,
} from "@/app/lib/subscription";

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

type DepotFilter = "all" | "active" | "inactive" | "missing-code";

export default function DepotsPage() {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [depotFilter, setDepotFilter] = useState<DepotFilter>("all");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDeleteDepot, setPendingDeleteDepot] = useState<Depot | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);

  const loadDepots = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setPageError("Please sign in again to manage depots.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    try {
      const [loadedDepots, loadedUsage] = await Promise.all([
        getDepotsForUser(user.id),
        getSubscriptionUsage(user.id),
      ]);
      setDepots(loadedDepots);
      setSubscriptionUsage(loadedUsage);
    } catch {
      setPageError("We could not load your depots. Refresh the page and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActiveRequest = true;

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!isActiveRequest) return;

        if (!user) {
          setPageError("Please sign in again to manage depots.");
          setLoading(false);
          return;
        }

        setUserId(user.id);

        Promise.all([
          getDepotsForUser(user.id),
          getSubscriptionUsage(user.id),
        ])
          .then(([loadedDepots, loadedUsage]) => {
            if (!isActiveRequest) return;

            setDepots(loadedDepots);
            setSubscriptionUsage(loadedUsage);
            setLoading(false);
          })
          .catch(() => {
            if (!isActiveRequest) return;

            setPageError("We could not load your depots. Refresh the page and try again.");
            setLoading(false);
          });
      })
      .catch(() => {
        if (!isActiveRequest) return;

        setPageError("We could not confirm your session. Please sign in again.");
        setLoading(false);
      });

    return () => {
      isActiveRequest = false;
    };
  }, []);

  const resetCreateForm = () => {
    setName("");
    setCode("");
    setNotes("");
    setIsActive(true);
  };

  const currentPlan = subscriptionUsage.subscription.plan;
  const currentPlanName = formatPlanName(currentPlan);
  const depotLimit = getSubscriptionDepotLimit(
    subscriptionUsage.subscription
  );
  const reachedDepotLimit = depots.length >= depotLimit;
  const requiredPlan = getUpgradePlanForDepotLimit(currentPlan);
  const visibleDepots = useMemo(
    () =>
      depots.filter(
        (depot) =>
          depotFilter === "all" ||
          (depotFilter === "active" && depot.is_active) ||
          (depotFilter === "inactive" && !depot.is_active) ||
          (depotFilter === "missing-code" && !depot.code?.trim())
      ),
    [depotFilter, depots]
  );
  const depotFilters: { value: DepotFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: depots.length },
    {
      value: "active",
      label: "Active",
      count: depots.filter((depot) => depot.is_active).length,
    },
    {
      value: "inactive",
      label: "Inactive",
      count: depots.filter((depot) => !depot.is_active).length,
    },
    {
      value: "missing-code",
      label: "Missing code",
      count: depots.filter((depot) => !depot.code?.trim()).length,
    },
  ];

  const handleCreateDepot = async (event: React.FormEvent) => {
    event.preventDefault();

    if (saving) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      setPageError("Add a depot name before saving.");
      setPageNotice("");
      return;
    }

    try {
      setSaving(true);
      setPageError("");
      setPageNotice("");

      const currentUserId =
        userId ||
        (
          await supabase.auth.getUser()
        ).data.user?.id;

      if (!currentUserId) {
        setPageError("Please sign in again before creating a depot.");
        return;
      }

      const [freshDepots, freshUsage] = await Promise.all([
        getDepotsForUser(currentUserId),
        getSubscriptionUsage(currentUserId),
      ]);
      const freshDepotLimit = getSubscriptionDepotLimit(
        freshUsage.subscription
      );

      setDepots(freshDepots);
      setSubscriptionUsage(freshUsage);

      if (freshDepots.length >= freshDepotLimit) {
        setPageError(
          `You reached the ${formatPlanName(
            freshUsage.subscription.plan
          )} plan limit of ${freshDepotLimit} depot${
            freshDepotLimit === 1 ? "" : "s"
          }. Existing depots remain available.`
        );
        return;
      }

      await createDepot(currentUserId, {
        name: trimmedName,
        code,
        notes,
        is_active: isActive,
      });
      resetCreateForm();
      setPageNotice("Depot added successfully.");
      await loadDepots();
    } catch {
      setPageError("We could not save this depot. Check for duplicate names and try again.");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (depot: Depot) => {
    setEditingId(depot.id);
    setEditName(depot.name);
    setEditCode(depot.code || "");
    setEditNotes(depot.notes || "");
    setEditIsActive(depot.is_active);
    setPageError("");
    setPageNotice("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditCode("");
    setEditNotes("");
    setEditIsActive(true);
  };

  const handleUpdateDepot = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editingId || saving) return;

    const trimmedName = editName.trim();

    if (!trimmedName) {
      setPageError("Add a depot name before saving changes.");
      setPageNotice("");
      return;
    }

    try {
      setSaving(true);
      setPageError("");
      setPageNotice("");

      if (!userId) {
        setPageError("Please sign in again before updating this depot.");
        return;
      }

      await updateDepot(userId, editingId, {
        name: trimmedName,
        code: editCode,
        notes: editNotes,
        is_active: editIsActive,
      });
      cancelEditing();
      setPageNotice("Depot updated successfully.");
      await loadDepots();
    } catch {
      setPageError("We could not update this depot. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepot = async (depot: Depot) => {
    if (deletingId) return;

    try {
      setDeletingId(depot.id);
      setPageError("");
      setPageNotice("");

      if (!userId) {
        setPageError("Please sign in again before deleting this depot.");
        return;
      }

      await deleteDepot(userId, depot.id);
      setPageNotice("Depot deleted. Assigned items were moved to Unassigned.");
      setPendingDeleteDepot(null);
      await loadDepots();
    } catch {
      setPageError("We could not delete this depot. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="contents">
      <main className="organize-workspace organize-depots">
        <DashboardPageShell width="compact">
          <DashboardPageHeader
            eyebrow="Locations"
            title="Depots"
            description="Manage the places where inventory items live."
            actions={
              <ActionButton
                href="/dashboard/inventory"
                variant="secondary"
                className="organize-inventory-link"
              >
                Back to Inventory
              </ActionButton>
            }
          />

          {(pageNotice || pageError) && (
            <DashboardNotice tone={pageError ? "danger" : "success"}>
              {pageError || pageNotice}
            </DashboardNotice>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <form
              onSubmit={handleCreateDepot}
              aria-busy={saving}
              className="dashboard-card organize-depot-form"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                New depot
              </p>

              <h2 className="mt-1 text-xl font-black tracking-tight text-theme-primary">
                Add Location
              </h2>

              {!loading && reachedDepotLimit ? (
                <div className="mt-6">
                  <LockedFeaturePanel
                    feature={`${currentPlanName} depot limit reached`}
                    benefit={`${currentPlanName} includes up to ${depotLimit} depot${
                      depotLimit === 1 ? "" : "s"
                    }. Existing locations remain visible, editable, and removable.`}
                    currentPlan={currentPlanName}
                    requiredPlan={requiredPlan}
                    source="depot-limit"
                    compact
                  />
                </div>
              ) : (
                <>
                  {/* Same label/value rows as Add Item, the invoice,
                      Customers and Suppliers. */}
                  <div className="item-form -mx-1 mt-4">
                    <FieldGroup>
                      <FieldRow label="Name" htmlFor="depot-name" required>
                        <input
                          id="depot-name"
                          type="text"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="e.g. Main warehouse"
                          required
                        />
                      </FieldRow>

                      <FieldRow label="Code" htmlFor="depot-code">
                        <input
                          id="depot-code"
                          type="text"
                          value={code}
                          onChange={(event) => setCode(event.target.value)}
                          placeholder="Short label, e.g. WH1"
                        />
                      </FieldRow>
                    </FieldGroup>

                    <FieldGroup label="Notes">
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Anything worth remembering about this location"
                        className="item-panel-textarea"
                      />
                    </FieldGroup>

                    <FieldGroup>
                      <FieldRow label="Active" htmlFor="depot-active">
                        <label
                          htmlFor="depot-active"
                          className="flex items-center gap-2 text-sm text-theme-primary"
                        >
                          <input
                            id="depot-active"
                            type="checkbox"
                            checked={isActive}
                            onChange={(event) => setIsActive(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-sydin-blue focus:ring-sydin-blue/50"
                          />
                          Shown in item forms
                        </label>
                      </FieldRow>
                    </FieldGroup>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="submit"
                      loading={saving}
                      loadingLabel="Saving depot..."
                    >
                      Add Depot
                    </Button>
                  </div>
                </>
              )}
            </form>

            <section className="dashboard-card organize-depot-list-panel">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                    Saved locations
                  </p>

                  <h2 className="mt-1 text-xl font-black tracking-tight text-theme-primary">
                    Depot List
                  </h2>
                </div>

                <span className="self-start rounded-full border border-sydin-blue/25 bg-sydin-blue/15 px-4 py-2 text-sm font-bold text-theme-accent sm:self-auto">
                  {depots.length} {depots.length === 1 ? "depot" : "depots"}
                </span>
              </div>
              <FilterBar label="Depot filters" className="mt-4">
                {depotFilters.map((filter) => (
                  <FilterChip
                    key={filter.value}
                    active={depotFilter === filter.value}
                    count={filter.count}
                    onClick={() => setDepotFilter(filter.value)}
                  >
                    {filter.label}
                  </FilterChip>
                ))}
              </FilterBar>

              {loading ? (
                <LoadingSkeletonGroup
                  count={3}
                  className="mt-6"
                  itemClassName="min-h-32"
                />
              ) : visibleDepots.length > 0 ? (
                <div className="organize-list-grid mt-6 grid grid-cols-1 gap-4">
                  {visibleDepots.map((depot) => (
                    <div
                      key={depot.id}
                      className="organize-row organize-depot-row relative rounded-2xl border border-theme bg-theme-inset p-4"
                    >
                      {editingId === depot.id ? (
                        <form onSubmit={handleUpdateDepot}>
                          {/* Was the old boxed layout while the Add form next
                              to it had already moved to rows: two shapes for
                              the same four fields. */}
                          <div className="item-form -mx-1">
                            <FieldGroup>
                              <FieldRow
                                label="Name"
                                htmlFor={`depot-edit-name-${depot.id}`}
                                required
                              >
                                <input
                                  id={`depot-edit-name-${depot.id}`}
                                  type="text"
                                  value={editName}
                                  onChange={(event) =>
                                    setEditName(event.target.value)
                                  }
                                  required
                                  autoFocus
                                />
                              </FieldRow>
                              <FieldRow
                                label="Code"
                                htmlFor={`depot-edit-code-${depot.id}`}
                              >
                                <input
                                  id={`depot-edit-code-${depot.id}`}
                                  type="text"
                                  value={editCode}
                                  onChange={(event) =>
                                    setEditCode(event.target.value)
                                  }
                                  placeholder="Short label, e.g. WH1"
                                />
                              </FieldRow>
                              <FieldRow
                                label="Active"
                                htmlFor={`depot-edit-active-${depot.id}`}
                              >
                                <label
                                  htmlFor={`depot-edit-active-${depot.id}`}
                                  className="flex items-center gap-2 text-sm text-theme-primary"
                                >
                                  <input
                                    id={`depot-edit-active-${depot.id}`}
                                    type="checkbox"
                                    checked={editIsActive}
                                    onChange={(event) =>
                                      setEditIsActive(event.target.checked)
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-sydin-blue focus:ring-sydin-blue/50"
                                  />
                                  Shown in item forms
                                </label>
                              </FieldRow>
                            </FieldGroup>

                            <FieldGroup label="Notes">
                              <textarea
                                value={editNotes}
                                onChange={(event) =>
                                  setEditNotes(event.target.value)
                                }
                                placeholder="Anything worth remembering about this location"
                                className="item-panel-textarea"
                              />
                            </FieldGroup>
                          </div>

                          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              variant="secondary"
                              onClick={cancelEditing}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              loading={saving}
                              loadingLabel="Saving..."
                            >
                              Save Changes
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words text-base font-extrabold text-theme-primary">
                                {depot.name}
                              </h3>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                                  depot.is_active
                                    ? "border-emerald-400/25 bg-emerald-500/10 text-theme-success"
                                    : "border-slate-400/20 bg-theme-surface text-theme-muted"
                                }`}
                              >
                                {depot.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-semibold text-theme-accent">
                              {depot.code || "No code"}
                            </p>

                            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-theme-muted">
                              {depot.notes || "No notes added."}
                            </p>
                          </div>

                          {/* Actions stay on one line instead of stacking at lg.
                              The stack was what set the row height (107px of
                              buttons against 90px of copy); side by side, the
                              copy sets it again. */}
                          <div className="organize-row-actions organize-desktop-actions flex shrink-0 flex-row gap-2">
                            <ActionButton onClick={() => startEditing(depot)}>
                              Edit
                            </ActionButton>

                            <ActionButton
                              variant="danger"
                              onClick={() => setPendingDeleteDepot(depot)}
                              disabled={deletingId === depot.id}
                            >
                              {deletingId === depot.id ? "Deleting..." : "Delete"}
                            </ActionButton>
                          </div>
                          <details className="organize-action-menu organize-mobile-actions">
                            <summary aria-label={`More actions for ${formatDepotLabel(depot)}`}>
                              <UiIcon name="more" className="h-4 w-4" />
                            </summary>
                            <div>
                              <button
                                type="button"
                                onClick={() => startEditing(depot)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteDepot(depot)}
                                disabled={deletingId === depot.id}
                                className="organize-danger-action"
                              >
                                {deletingId === depot.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <DashboardEmptyState
                  className="mt-6"
                  icon="depots"
                  title={depots.length === 0 ? "No depots yet" : "No depots found"}
                  description={
                    depots.length === 0
                      ? "Add your first location to assign inventory items to a depot."
                      : "Try another location filter."
                  }
                />
              )}
            </section>
          </div>
        </DashboardPageShell>
      </main>

      {pendingDeleteDepot && (
        <DialogShell
          title={`Delete ${formatDepotLabel(pendingDeleteDepot)}?`}
          eyebrow="Delete depot"
          description="Items assigned to this depot will become Unassigned. Inventory items will not be deleted."
          tone="danger"
          onClose={() => {
            if (!deletingId) setPendingDeleteDepot(null);
          }}
          closeDisabled={deletingId !== null}
          className="max-w-md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setPendingDeleteDepot(null)}
                disabled={deletingId !== null}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleDeleteDepot(pendingDeleteDepot)}
                disabled={deletingId !== null}
                loading={deletingId === pendingDeleteDepot.id}
                loadingLabel="Deleting..."
                className="flex-1"
              >
                Delete Depot
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
