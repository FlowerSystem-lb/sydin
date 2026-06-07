"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
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

export default function DepotsPage() {
  const [depots, setDepots] = useState<Depot[]>([]);
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
    <div className="liquid-bg min-h-screen overflow-x-hidden text-white">
      <Sidebar planName={currentPlanName} />

      <main className="px-4 py-6 sm:px-6 lg:pl-[312px] lg:pr-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-8">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Locations
                </p>

                <h1 className="mt-2 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Depots
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                  Manage the places where inventory items live.
                </p>
              </div>

              <Link
                href="/dashboard/inventory"
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center text-base font-bold text-white transition hover:border-white/20 hover:bg-white/[0.1]"
              >
                Back to Inventory
              </Link>
            </div>
          </section>

          {(pageNotice || pageError) && (
            <div
              className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
                pageError
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {pageError || pageNotice}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <form
              onSubmit={handleCreateDepot}
              aria-busy={saving}
              className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-7"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                New depot
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight">
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
                  <div className="mt-6 grid grid-cols-1 gap-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-400">
                        Name
                      </label>

                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-400">
                        Code
                      </label>

                      <input
                        type="text"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-400">
                        Notes
                      </label>

                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className="min-h-[120px] w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                      />
                    </div>

                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-indigo-300/20 bg-indigo-500/10 px-5 py-4">
                      <span>
                        <span className="block text-sm font-bold text-white">
                          Active
                        </span>

                        <span className="mt-1 block text-xs text-slate-400">
                          Active depots appear in item forms.
                        </span>
                      </span>

                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(event) => setIsActive(event.target.checked)}
                        className="h-6 w-6 accent-indigo-400"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="mt-6 w-full rounded-2xl bg-white px-6 py-4 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving depot..." : "Add Depot"}
                  </button>
                </>
              )}
            </form>

            <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                    Saved locations
                  </p>

                  <h2 className="mt-2 text-3xl font-bold tracking-tight">
                    Depot List
                  </h2>
                </div>

                <span className="self-start rounded-full border border-indigo-300/25 bg-indigo-500/15 px-4 py-2 text-sm font-bold text-indigo-100 sm:self-auto">
                  {depots.length} {depots.length === 1 ? "depot" : "depots"}
                </span>
              </div>

              {loading ? (
                <div className="mt-6 grid grid-cols-1 gap-4">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-32 overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04]"
                    >
                      <div className="h-full animate-pulse bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03]" />
                    </div>
                  ))}
                </div>
              ) : depots.length > 0 ? (
                <div className="mt-6 grid grid-cols-1 gap-4">
                  {depots.map((depot) => (
                    <div
                      key={depot.id}
                      className="rounded-[26px] border border-white/10 bg-black/25 p-4 sm:p-5"
                    >
                      {editingId === depot.id ? (
                        <form
                          onSubmit={handleUpdateDepot}
                          className="grid grid-cols-1 gap-4"
                        >
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-semibold text-slate-400">
                                Name
                              </label>

                              <input
                                type="text"
                                value={editName}
                                onChange={(event) =>
                                  setEditName(event.target.value)
                                }
                                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-300/60 focus:bg-white/[0.08]"
                                required
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-semibold text-slate-400">
                                Code
                              </label>

                              <input
                                type="text"
                                value={editCode}
                                onChange={(event) =>
                                  setEditCode(event.target.value)
                                }
                                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-300/60 focus:bg-white/[0.08]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-400">
                              Notes
                            </label>

                            <textarea
                              value={editNotes}
                              onChange={(event) =>
                                setEditNotes(event.target.value)
                              }
                              className="min-h-[100px] w-full resize-y rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base text-white outline-none transition focus:border-indigo-300/60 focus:bg-white/[0.08]"
                            />
                          </div>

                          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-indigo-300/20 bg-indigo-500/10 px-4 py-3">
                            <span className="text-sm font-bold text-white">
                              Active
                            </span>

                            <input
                              type="checkbox"
                              checked={editIsActive}
                              onChange={(event) =>
                                setEditIsActive(event.target.checked)
                              }
                              className="h-6 w-6 accent-indigo-400"
                            />
                          </label>

                          <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={saving}
                              className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                            >
                              Cancel
                            </button>

                            <button
                              type="submit"
                              disabled={saving}
                              className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
                            >
                              {saving ? "Saving..." : "Save Changes"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words text-2xl font-bold text-white">
                                {depot.name}
                              </h3>

                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                                  depot.is_active
                                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                    : "border-slate-400/20 bg-white/[0.05] text-slate-400"
                                }`}
                              >
                                {depot.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-semibold text-indigo-200">
                              {depot.code || "No code"}
                            </p>

                            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">
                              {depot.notes || "No notes added."}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
                            <button
                              type="button"
                              onClick={() => startEditing(depot)}
                              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-slate-200"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => setPendingDeleteDepot(depot)}
                              disabled={deletingId === depot.id}
                              className="rounded-2xl border border-red-400/25 bg-red-500/15 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId === depot.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-[26px] border border-dashed border-indigo-300/25 bg-black/25 px-5 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-500/15 text-lg font-black text-indigo-100">
                    0
                  </div>

                  <h3 className="mt-5 text-2xl font-bold text-white">
                    No depots yet
                  </h3>

                  <p className="mx-auto mt-2 max-w-md text-base leading-7 text-slate-400">
                    Add your first location to assign inventory items to a depot.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {pendingDeleteDepot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02030a]/85 p-4 backdrop-blur-xl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-depot-title"
            className="w-full max-w-md rounded-[28px] border border-red-400/20 bg-[#080b18]/95 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.6)] sm:p-7"
          >
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-300">
              Delete depot
            </p>
            <h2 id="delete-depot-title" className="mt-3 break-words text-2xl font-bold text-white">
              Delete {formatDepotLabel(pendingDeleteDepot)}?
            </h2>
            <p className="mt-3 leading-7 text-slate-400">
              Items assigned to this depot will become Unassigned. Inventory items will not be deleted.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setPendingDeleteDepot(null)}
                disabled={deletingId !== null}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3.5 font-bold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteDepot(pendingDeleteDepot)}
                disabled={deletingId !== null}
                className="flex-1 rounded-2xl border border-red-400/25 bg-red-500/20 px-5 py-3.5 font-bold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === pendingDeleteDepot.id ? "Deleting..." : "Delete Depot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
