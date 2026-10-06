"use client";

/* Depots (redesign, 6 Oct 2026) -- Sayed's spec and screenshots:
   a searchable list on the left, the selected depot on the right with its
   contact and location filled in place (phone, address, map link), copy and
   call shortcuts, actions, and a New/Edit side drawer with a live preview.
   Phase 37 added phone, address, map_url and is_default to `depots`. */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import UiIcon from "@/components/UiIcon";
import {
  DashboardEmptyState,
  DashboardNotice,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { buttonClassName, useToast } from "@/components/ui";
import {
  clearDefaultDepot,
  countStockedItemsInDepot,
  createDepot,
  deleteDepot,
  depotMissingInfo,
  depotProfileScore,
  depotTelUrl,
  depotWhatsAppUrl,
  formatDepotPhone,
  getDepotErrorMessage,
  getDepotsForUser,
  looksLikeMapsUrl,
  mapsSearchUrl,
  setDefaultDepot,
  shortMapUrl,
  suggestDepotCode,
  updateDepot,
  updateDepotFields,
  type Depot,
} from "@/app/lib/depots";
import { getBusinessUser } from "@/app/lib/business";
import { useCanDelete } from "@/components/dashboard/BusinessContext";
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

type DepotFilter = "all" | "active" | "inactive" | "missing";

type DraftDepot = {
  name: string;
  code: string;
  phone: string;
  address: string;
  map_url: string;
  notes: string;
  is_active: boolean;
  is_default: boolean;
};

const EMPTY_DRAFT: DraftDepot = {
  name: "",
  code: "",
  phone: "",
  address: "",
  map_url: "",
  notes: "",
  is_active: true,
  is_default: false,
};

function initialOf(name: string) {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

function copyText(value: string) {
  return navigator.clipboard?.writeText(value) ?? Promise.reject(new Error("no clipboard"));
}

export default function DepotsPage() {
  const canDeleteRecords = useCanDelete();
  const { showToast } = useToast();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DepotFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);

  // Inline "fill it in now" rows on the detail panel.
  const [inlinePhone, setInlinePhone] = useState("");
  const [inlineAddress, setInlineAddress] = useState("");
  const [inlineMap, setInlineMap] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);

  // Delete confirm, inline in the actions card.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stockedCount, setStockedCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Drawer.
  const [drawer, setDrawer] = useState<"new" | "edit" | null>(null);
  const [draft, setDraft] = useState<DraftDepot>(EMPTY_DRAFT);
  const [draftError, setDraftError] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const toast = (message: string, tone: "success" | "danger" = "success") =>
    showToast({ tone, message });

  /* ---------------- load ---------------- */
  useEffect(() => {
    let active = true;
    getBusinessUser()
      .then(({ data: { user } }) => {
        if (!active) return;
        if (!user) {
          setPageError("Please sign in again to manage depots.");
          setLoading(false);
          return;
        }
        setUserId(user.id);
        Promise.all([getDepotsForUser(user.id), getSubscriptionUsage(user.id)])
          .then(([loaded, usage]) => {
            if (!active) return;
            setDepots(loaded);
            setSubscriptionUsage(usage);
            // The selected depot lives in the URL (?id=) so it can be linked.
            const requested = Number(new URLSearchParams(window.location.search).get("id"));
            const initial =
              loaded.find((depot) => depot.id === requested) ||
              loaded.find((depot) => depot.is_default) ||
              loaded[0];
            setSelectedId(initial ? initial.id : null);
            setLoading(false);
          })
          .catch(() => {
            if (!active) return;
            setPageError("We could not load your depots. Refresh the page and try again.");
            setLoading(false);
          });
      })
      .catch(() => {
        if (!active) return;
        setPageError("We could not confirm your session. Please sign in again.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectDepot = (id: number) => {
    setSelectedId(id);
    setInlinePhone("");
    setInlineAddress("");
    setInlineMap("");
    setConfirmDelete(false);
    setStockedCount(null);
    const url = new URL(window.location.href);
    url.searchParams.set("id", String(id));
    window.history.replaceState(null, "", url.toString());
  };

  /* ---------------- derived ---------------- */
  const selected = depots.find((depot) => depot.id === selectedId) || null;
  const counts = {
    all: depots.length,
    active: depots.filter((depot) => depot.is_active).length,
    inactive: depots.filter((depot) => !depot.is_active).length,
    missing: depots.filter((depot) => depotMissingInfo(depot)).length,
  };
  const visibleDepots = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return depots.filter((depot) => {
      if (filter === "active" && !depot.is_active) return false;
      if (filter === "inactive" && depot.is_active) return false;
      if (filter === "missing" && !depotMissingInfo(depot)) return false;
      if (!needle) return true;
      return [depot.name, depot.code, depot.phone, depot.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [depots, filter, search]);

  const currentPlan = subscriptionUsage.subscription.plan;
  const currentPlanName = formatPlanName(currentPlan);
  const depotLimit = getSubscriptionDepotLimit(subscriptionUsage.subscription);
  const reachedDepotLimit = depots.length >= depotLimit;

  const replaceDepot = (next: Depot) =>
    setDepots((current) => current.map((depot) => (depot.id === next.id ? next : depot)));

  /* ---------------- inline saves (optimistic) ---------------- */
  const saveField = async (
    field: "phone" | "address" | "map_url" | "is_active",
    value: string | boolean,
    label: string
  ) => {
    if (!selected || !userId) return;
    const before = selected;
    replaceDepot({ ...selected, [field]: value } as Depot);
    setSavingField(field);
    try {
      const saved = await updateDepotFields(userId, selected.id, { [field]: value });
      replaceDepot(saved);
      if (field === "phone") setInlinePhone("");
      if (field === "address") setInlineAddress("");
      if (field === "map_url") setInlineMap("");
      toast(label);
    } catch (error) {
      replaceDepot(before);
      toast(getDepotErrorMessage(error), "danger");
    } finally {
      setSavingField(null);
    }
  };

  const toggleDefault = async () => {
    if (!selected || !userId) return;
    const before = depots;
    const makeDefault = !selected.is_default;
    setDepots((current) =>
      current.map((depot) => ({
        ...depot,
        is_default: makeDefault ? depot.id === selected.id : depot.id === selected.id ? false : depot.is_default,
      }))
    );
    try {
      if (makeDefault) await setDefaultDepot(selected.id);
      else await clearDefaultDepot(userId, selected.id);
      toast(makeDefault ? `${selected.name} is now the default depot` : "Default depot cleared");
    } catch (error) {
      setDepots(before);
      toast(getDepotErrorMessage(error), "danger");
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await copyText(value);
      toast(label);
    } catch {
      toast("Could not copy. Select the text and copy it instead.", "danger");
    }
  };

  const copyAll = () => {
    if (!selected) return;
    const lines = [
      selected.code ? `${selected.name} (${selected.code})` : selected.name,
      selected.phone ? `Phone: ${formatDepotPhone(selected.phone)}` : "",
      selected.address ? `Address: ${selected.address}` : "",
      selected.map_url ? `Map: ${selected.map_url}` : "",
    ].filter(Boolean);
    void copy(lines.join("\n"), "Depot details copied");
  };

  /* ---------------- duplicate / delete ---------------- */
  const duplicate = async () => {
    if (!selected || !userId) return;
    if (reachedDepotLimit) {
      toast(`The ${currentPlanName} plan allows ${depotLimit} depots.`, "danger");
      return;
    }
    try {
      const created = await createDepot(userId, {
        name: `${selected.name} copy`,
        phone: selected.phone || "",
        address: selected.address || "",
        map_url: selected.map_url || "",
        notes: selected.notes || "",
        is_active: selected.is_active,
      });
      setDepots((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      selectDepot(created.id);
      toast("Depot duplicated");
    } catch (error) {
      toast(getDepotErrorMessage(error), "danger");
    }
  };

  const askDelete = async () => {
    if (!selected || !userId) return;
    setConfirmDelete(true);
    setStockedCount(null);
    try {
      setStockedCount(await countStockedItemsInDepot(userId, selected.id));
    } catch {
      setStockedCount(0);
    }
  };

  const runDelete = async () => {
    if (!selected || !userId || deleting) return;
    setDeleting(true);
    try {
      await deleteDepot(userId, selected.id);
      const remaining = depots.filter((depot) => depot.id !== selected.id);
      setDepots(remaining);
      setConfirmDelete(false);
      if (remaining[0]) selectDepot(remaining[0].id);
      else setSelectedId(null);
      toast("Depot deleted. Its items moved to Unassigned.");
    } catch {
      toast("We could not delete this depot. Please try again.", "danger");
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- drawer ---------------- */
  const openNew = () => {
    setDraft(EMPTY_DRAFT);
    setDraftError("");
    setNameError("");
    setDrawer("new");
  };

  const openEdit = () => {
    if (!selected) return;
    setDraft({
      name: selected.name,
      code: selected.code || "",
      phone: selected.phone || "",
      address: selected.address || "",
      map_url: selected.map_url || "",
      notes: selected.notes || "",
      is_active: selected.is_active,
      is_default: selected.is_default === true,
    });
    setDraftError("");
    setNameError("");
    setDrawer("edit");
  };

  useEffect(() => {
    if (!drawer) return;
    const frame = window.requestAnimationFrame(() => nameRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingDraft) setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer, savingDraft]);

  const submitDraft = async (addAnother: boolean) => {
    if (savingDraft || !userId) return;
    if (!draft.name.trim()) {
      setNameError("Give the depot a name.");
      nameRef.current?.focus();
      return;
    }
    setSavingDraft(true);
    setDraftError("");
    setNameError("");
    try {
      const input = {
        name: draft.name,
        code: draft.code,
        phone: draft.phone,
        address: draft.address,
        map_url: draft.map_url,
        notes: draft.notes,
        is_active: draft.is_active,
      };
      let saved: Depot;
      if (drawer === "edit" && selected) {
        saved = await updateDepot(userId, selected.id, input);
      } else {
        const usage = await getSubscriptionUsage(userId);
        if (depots.length >= getSubscriptionDepotLimit(usage.subscription)) {
          setDraftError(
            `You reached the ${formatPlanName(usage.subscription.plan)} plan limit of ${getSubscriptionDepotLimit(
              usage.subscription
            )} depots. Existing depots remain available.`
          );
          return;
        }
        saved = await createDepot(userId, input);
      }

      // Default is its own one-per-business step (phase 37 function).
      if (draft.is_default && !saved.is_default) {
        await setDefaultDepot(saved.id);
      } else if (!draft.is_default && saved.is_default) {
        await clearDefaultDepot(userId, saved.id);
      }
      const fresh = await getDepotsForUser(userId);
      setDepots(fresh);
      selectDepot(saved.id);
      toast(drawer === "edit" ? "Depot saved" : `${saved.name} added`);

      if (addAnother && drawer === "new") {
        setDraft(EMPTY_DRAFT);
        window.requestAnimationFrame(() => nameRef.current?.focus());
      } else {
        setDrawer(null);
      }
    } catch (error) {
      setDraftError(getDepotErrorMessage(error, draft.code.toUpperCase()));
    } finally {
      setSavingDraft(false);
    }
  };

  const draftScore = depotProfileScore(draft);
  const mapHint = !draft.map_url.trim()
    ? { tone: "muted", text: "Open the place in Google Maps › Share › Copy link, then paste here." }
    : looksLikeMapsUrl(draft.map_url)
      ? { tone: "ok", text: `✓ Looks like a Maps link — it will show as ${shortMapUrl(draft.map_url)}` }
      : { tone: "bad", text: "This does not look like a Google Maps link." };

  /* ---------------- render ---------------- */
  const score = selected ? depotProfileScore(selected) : 0;

  return (
    <div className="contents">
      <main className="depots-v3">
        <div className="depots-v3-inner">
          <header className="depots-v3-head">
            <div>
              <p className="depots-v3-crumb">
                <Link href="/dashboard/inventory">Inventory</Link> / <strong>Depots</strong>
              </p>
              <h1>Depots</h1>
              <p className="depots-v3-summary">
                {counts.all} {counts.all === 1 ? "depot" : "depots"} · {counts.active} active ·{" "}
                {counts.missing} missing contact or location
              </p>
            </div>
            <button
              type="button"
              onClick={openNew}
              disabled={loading}
              className={buttonClassName({ size: "lg" })}
            >
              <UiIcon name="plus" className="h-4 w-4" />
              New depot
            </button>
          </header>

          {pageError && <DashboardNotice tone="danger">{pageError}</DashboardNotice>}

          {!loading && reachedDepotLimit && (
            <LockedFeaturePanel
              feature={`${currentPlanName} depot limit reached`}
              benefit={`${currentPlanName} includes up to ${depotLimit} depot${depotLimit === 1 ? "" : "s"}. Existing locations remain visible, editable, and removable.`}
              currentPlan={currentPlanName}
              requiredPlan={getUpgradePlanForDepotLimit(currentPlan)}
              source="depot-limit"
              compact
            />
          )}

          {loading ? (
            <LoadingSkeletonGroup count={3} itemClassName="min-h-28" />
          ) : depots.length === 0 ? (
            <DashboardEmptyState
              icon="depots"
              title="No depots yet"
              description="Add your first location to assign inventory items to a depot, with its phone, address and map link in one place."
              action={
                <button type="button" onClick={openNew} className={buttonClassName()}>
                  <UiIcon name="plus" className="h-4 w-4" />
                  New depot
                </button>
              }
            />
          ) : (
            <div className="depots-v3-grid">
              {/* ---------- list ---------- */}
              <section className="depots-v3-card depots-v3-list" aria-label="Depot list">
                <div className="depots-v3-list-tools">
                  <label className="depots-v3-search">
                    <UiIcon name="search" className="h-4 w-4" />
                    <span className="sr-only">Search depots</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Name, code, phone or address"
                    />
                  </label>
                  <div className="depots-v3-chips" role="group" aria-label="Depot filters">
                    {(
                      [
                        ["all", "All"],
                        ["active", "Active"],
                        ["inactive", "Inactive"],
                        ["missing", "Missing info"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                        className={filter === value ? "is-active" : ""}
                      >
                        {label} <span>{counts[value]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {visibleDepots.length === 0 ? (
                  <p className="depots-v3-none">No depots match.</p>
                ) : (
                  <ul>
                    {visibleDepots.map((depot) => (
                      <li key={depot.id}>
                        <button
                          type="button"
                          onClick={() => selectDepot(depot.id)}
                          aria-current={depot.id === selectedId ? "true" : undefined}
                          className={`depots-v3-row ${depot.id === selectedId ? "is-selected" : ""}`}
                        >
                          <span className="depots-v3-avatar" aria-hidden="true">
                            {initialOf(depot.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="depots-v3-row-name">
                              {depot.name}
                              {depot.is_default && <span className="depots-v3-default">Default</span>}
                            </span>
                            <span className="depots-v3-row-meta">
                              <span className="depots-v3-mono">{depot.code || "no code"}</span>
                              {" · "}
                              <span className={depot.is_active ? "is-on" : "is-off"}>
                                {depot.is_active ? "Active" : "Inactive"}
                              </span>
                            </span>
                          </span>
                          <span
                            className={`depots-v3-dot ${depot.phone ? "is-set" : ""}`}
                            title={depot.phone ? "Phone saved" : "No phone"}
                          >
                            <UiIcon name="phone" className="h-3.5 w-3.5" />
                          </span>
                          <span
                            className={`depots-v3-dot ${depot.map_url || depot.address ? "is-set" : ""}`}
                            title={depot.map_url || depot.address ? "Location saved" : "No location"}
                          >
                            <UiIcon name="map-pin" className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ---------- detail ---------- */}
              {selected && (
                <div className="depots-v3-detail">
                  <section className="depots-v3-card depots-v3-hero">
                    <div className="depots-v3-hero-top">
                      <span className="depots-v3-avatar depots-v3-avatar-lg" aria-hidden="true">
                        {initialOf(selected.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2>{selected.name}</h2>
                        <div className="depots-v3-hero-tags">
                          {selected.code ? (
                            <span className="depots-v3-chip depots-v3-mono">{selected.code}</span>
                          ) : (
                            <span className="depots-v3-chip is-warn">No code</span>
                          )}
                          <button
                            type="button"
                            onClick={() => void saveField("is_active", !selected.is_active, selected.is_active ? "Depot set inactive" : "Depot set active")}
                            className={`depots-v3-status ${selected.is_active ? "is-on" : "is-off"}`}
                            title="Click to switch"
                          >
                            <i aria-hidden="true" />
                            {selected.is_active ? "Active" : "Inactive"}
                          </button>
                          {selected.is_default && <span className="depots-v3-chip is-default">Default depot</span>}
                        </div>
                      </div>
                      <div className="depots-v3-hero-actions">
                        <button type="button" onClick={copyAll} className={buttonClassName({ variant: "secondary" })}>
                          <UiIcon name="copy" className="h-4 w-4" />
                          Copy all
                        </button>
                        <button type="button" onClick={openEdit} className="depots-v3-dark-button">
                          <UiIcon name="edit" className="h-4 w-4" />
                          Edit
                        </button>
                      </div>
                    </div>
                    <div className="depots-v3-progress">
                      <span>Profile complete</span>
                      <strong>{score} of 6</strong>
                    </div>
                    <span className={`depots-v3-bar ${score === 6 ? "is-done" : ""}`} aria-hidden="true">
                      <i style={{ width: `${(score / 6) * 100}%` }} />
                    </span>
                  </section>

                  <section className="depots-v3-card">
                    <h3 className="depots-v3-card-title">Contact &amp; location</h3>

                    {/* Phone */}
                    <div className="depots-v3-field">
                      <span className="depots-v3-field-icon is-green" aria-hidden="true">
                        <UiIcon name="phone" className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="depots-v3-field-label">Phone</p>
                        {selected.phone ? (
                          <p className="depots-v3-field-value depots-v3-mono">{formatDepotPhone(selected.phone)}</p>
                        ) : (
                          <form
                            className="depots-v3-inline"
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (inlinePhone.trim()) void saveField("phone", inlinePhone, "Phone saved");
                            }}
                          >
                            <span className="depots-v3-prefix">+961</span>
                            <input
                              type="tel"
                              inputMode="tel"
                              value={inlinePhone}
                              onChange={(event) => setInlinePhone(event.target.value)}
                              placeholder="03 123 456"
                              aria-label="Phone number"
                              className="ui-input depots-v3-mono"
                            />
                            <button type="submit" disabled={!inlinePhone.trim() || savingField === "phone"} className={buttonClassName()}>
                              Save
                            </button>
                          </form>
                        )}
                      </div>
                      {selected.phone && (
                        <div className="depots-v3-field-actions">
                          <a href={depotTelUrl(selected.phone)} className={buttonClassName({ variant: "secondary", size: "sm" })} aria-label="Call">
                            <UiIcon name="phone" className="h-4 w-4" />
                          </a>
                          <a
                            href={depotWhatsAppUrl(selected.phone)}
                            target="_blank"
                            rel="noreferrer"
                            className={`${buttonClassName({ variant: "secondary", size: "sm" })} depots-v3-wa`}
                          >
                            WhatsApp
                          </a>
                          <button
                            type="button"
                            onClick={() => void copy(formatDepotPhone(selected.phone), "Phone copied")}
                            className={buttonClassName({ variant: "secondary", size: "sm" })}
                            aria-label="Copy phone"
                          >
                            <UiIcon name="copy" className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Address */}
                    <div className="depots-v3-field">
                      <span className="depots-v3-field-icon is-blue" aria-hidden="true">
                        <UiIcon name="depots" className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="depots-v3-field-label">Address</p>
                        {selected.address ? (
                          <>
                            <p className="depots-v3-field-value">{selected.address}</p>
                            {!selected.map_url && (
                              <a
                                href={mapsSearchUrl(selected.address)}
                                target="_blank"
                                rel="noreferrer"
                                className="depots-v3-link"
                              >
                                Find this address on Google Maps →
                              </a>
                            )}
                          </>
                        ) : (
                          <form
                            className="depots-v3-inline"
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (inlineAddress.trim()) void saveField("address", inlineAddress, "Address saved");
                            }}
                          >
                            <input
                              value={inlineAddress}
                              onChange={(event) => setInlineAddress(event.target.value)}
                              placeholder="Street, building, area, city"
                              aria-label="Address"
                              className="ui-input"
                            />
                            <button type="submit" disabled={!inlineAddress.trim() || savingField === "address"} className={buttonClassName()}>
                              Save
                            </button>
                          </form>
                        )}
                      </div>
                      {selected.address && (
                        <div className="depots-v3-field-actions">
                          <button
                            type="button"
                            onClick={() => void copy(selected.address || "", "Address copied")}
                            className={buttonClassName({ variant: "secondary", size: "sm" })}
                            aria-label="Copy address"
                          >
                            <UiIcon name="copy" className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Map */}
                    <div className="depots-v3-field">
                      <span className="depots-v3-field-icon is-red" aria-hidden="true">
                        <UiIcon name="map-pin" className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="depots-v3-field-label">Map location</p>
                        {selected.map_url ? (
                          <a
                            href={selected.map_url}
                            target="_blank"
                            rel="noreferrer"
                            className="depots-v3-field-value depots-v3-mono depots-v3-maplink"
                            title={selected.map_url}
                          >
                            {shortMapUrl(selected.map_url)}
                          </a>
                        ) : (
                          <form
                            className="depots-v3-inline"
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (inlineMap.trim()) void saveField("map_url", inlineMap, "Map link saved");
                            }}
                          >
                            <input
                              type="url"
                              value={inlineMap}
                              onChange={(event) => setInlineMap(event.target.value)}
                              placeholder="Paste a Google Maps link"
                              aria-label="Google Maps link"
                              className="ui-input depots-v3-mono"
                            />
                            <button type="submit" disabled={!inlineMap.trim() || savingField === "map_url"} className={buttonClassName()}>
                              Save
                            </button>
                          </form>
                        )}
                      </div>
                      {selected.map_url && (
                        <div className="depots-v3-field-actions">
                          <a
                            href={selected.map_url}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonClassName({ variant: "secondary", size: "sm" })}
                          >
                            Open ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => void copy(selected.map_url || "", "Map link copied")}
                            className={buttonClassName({ variant: "secondary", size: "sm" })}
                            aria-label="Copy map link"
                          >
                            <UiIcon name="copy" className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="depots-v3-bottom">
                    <section className="depots-v3-card">
                      <h3 className="depots-v3-card-title">Notes</h3>
                      <p className={`depots-v3-notes ${selected.notes ? "" : "is-empty"}`}>
                        {selected.notes || "No notes yet. Opening hours, who manages it, gate code…"}
                      </p>
                    </section>

                    <section className="depots-v3-card depots-v3-actions">
                      <button type="button" onClick={() => void toggleDefault()}>
                        {selected.is_default ? "Remove as default depot" : "Set as default depot"}
                      </button>
                      <button type="button" onClick={() => void duplicate()}>
                        Duplicate depot
                      </button>
                      <Link href={`/dashboard/inventory?depot=${selected.id}`}>View items in this depot →</Link>
                      {canDeleteRecords &&
                        (confirmDelete ? (
                          <div className="depots-v3-confirm" role="alert">
                            <p>
                              Delete {selected.name}?
                              {stockedCount === null
                                ? " Checking stock…"
                                : stockedCount > 0
                                  ? ` ${stockedCount} item${stockedCount === 1 ? "" : "s"} with stock will move to Unassigned.`
                                  : " No items with stock are in it."}
                            </p>
                            <div>
                              <button
                                type="button"
                                onClick={() => void runDelete()}
                                disabled={deleting || stockedCount === null}
                                className={buttonClassName({ variant: "danger", size: "sm" })}
                              >
                                {deleting ? "Deleting…" : "Delete"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                className={buttonClassName({ variant: "secondary", size: "sm" })}
                              >
                                Keep
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => void askDelete()} className="is-danger">
                            Delete depot
                          </button>
                        ))}
                    </section>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ---------- New / Edit drawer ---------- */}
      {drawer && (
        <div className="depots-v3-overlay" onMouseDown={(event) => event.target === event.currentTarget && !savingDraft && setDrawer(null)}>
          <form
            className="depots-v3-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="depot-drawer-title"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submitDraft(false);
            }}
          >
            <header className="depots-v3-drawer-head">
              <div>
                <h2 id="depot-drawer-title">{drawer === "edit" ? "Edit depot" : "New depot"}</h2>
                <p>Only the name is required. Fill the rest now or later.</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className={buttonClassName({ variant: "secondary" })}
                aria-label="Close"
              >
                <UiIcon name="close" className="h-4 w-4" />
              </button>
            </header>

            <div className="depots-v3-drawer-body">
              <div className="depots-v3-drawer-form">
                {draftError && <DashboardNotice tone="danger">{draftError}</DashboardNotice>}
                <div className="depots-v3-two">
                  <label className="depots-v3-label">
                    <span>
                      Depot name <b>*</b>
                    </span>
                    <input
                      ref={nameRef}
                      value={draft.name}
                      onChange={(event) => {
                        setDraft({ ...draft, name: event.target.value });
                        setNameError("");
                      }}
                      placeholder="e.g. Achrafieh shop"
                      aria-invalid={Boolean(nameError)}
                      className="ui-input"
                    />
                    {nameError && <small className="is-bad">{nameError}</small>}
                  </label>
                  <label className="depots-v3-label">
                    <span>Code</span>
                    <span className="depots-v3-code-row">
                      <input
                        value={draft.code}
                        onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
                        placeholder="e.g. ACH1"
                        className="ui-input depots-v3-mono"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            code: suggestDepotCode(
                              draft.name,
                              depots.filter((depot) => drawer !== "edit" || depot.id !== selected?.id)
                            ),
                          })
                        }
                        disabled={!draft.name.trim()}
                        className="depots-v3-auto"
                      >
                        Auto
                      </button>
                    </span>
                  </label>
                </div>

                <label className="depots-v3-label">
                  <span>Phone number</span>
                  <span className="depots-v3-code-row">
                    <span className="depots-v3-prefix">LB +961</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={draft.phone}
                      onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                      placeholder="71 555 222"
                      className="ui-input depots-v3-mono"
                    />
                  </span>
                </label>

                <label className="depots-v3-label">
                  <span>Address</span>
                  <textarea
                    value={draft.address}
                    onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                    placeholder="Street, building, area, city"
                    rows={2}
                    className="ui-input"
                  />
                </label>

                <label className="depots-v3-label">
                  <span>Google Maps link</span>
                  <input
                    type="url"
                    value={draft.map_url}
                    onChange={(event) => setDraft({ ...draft, map_url: event.target.value })}
                    placeholder="https://maps.app.goo.gl/…"
                    className="ui-input depots-v3-mono"
                  />
                  <small className={mapHint.tone === "ok" ? "is-ok" : mapHint.tone === "bad" ? "is-bad" : ""}>
                    {mapHint.text}
                  </small>
                </label>

                <label className="depots-v3-label">
                  <span>Notes</span>
                  <textarea
                    value={draft.notes}
                    onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                    placeholder="Opening hours, who manages it, gate code…"
                    rows={3}
                    className="ui-input"
                  />
                </label>

                <div className="depots-v3-two">
                  <label className="depots-v3-check">
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
                    />
                    <span>
                      <strong>Active</strong>
                      <small>Pickable in item forms</small>
                    </span>
                  </label>
                  <label className="depots-v3-check">
                    <input
                      type="checkbox"
                      checked={draft.is_default}
                      onChange={(event) => setDraft({ ...draft, is_default: event.target.checked })}
                    />
                    <span>
                      <strong>Default depot</strong>
                      <small>Pre-selected for new items</small>
                    </span>
                  </label>
                </div>
              </div>

              <aside className="depots-v3-preview" aria-label="Live preview">
                <p className="depots-v3-preview-label">Live preview</p>
                <div className="depots-v3-preview-card">
                  <div className="depots-v3-preview-top">
                    <span className="depots-v3-avatar depots-v3-avatar-lg" aria-hidden="true">
                      {initialOf(draft.name || "?")}
                    </span>
                    <div className="min-w-0">
                      <strong>{draft.name || "Depot name"}</strong>
                      <small className="depots-v3-mono">
                        {draft.code || "no code"} · {draft.is_active ? "Active" : "Inactive"}
                      </small>
                    </div>
                  </div>
                  <dl>
                    <div>
                      <dt>Phone</dt>
                      <dd className="depots-v3-mono">{draft.phone ? formatDepotPhone(draft.phone.replace(/^\+?961\s*/, "")) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Address</dt>
                      <dd>{draft.address || "—"}</dd>
                    </div>
                    <div>
                      <dt>Map</dt>
                      <dd className="depots-v3-mono depots-v3-preview-map">{draft.map_url ? shortMapUrl(draft.map_url) : "—"}</dd>
                    </div>
                  </dl>
                  <div className="depots-v3-preview-progress">
                    <span>Profile</span>
                    <span>{draftScore} of 6</span>
                  </div>
                  <span className="depots-v3-preview-bar" aria-hidden="true">
                    <i style={{ width: `${(draftScore / 6) * 100}%` }} />
                  </span>
                </div>
                <p className="depots-v3-tip">Tip: press Enter in any field to save.</p>
              </aside>
            </div>

            <footer className="depots-v3-drawer-foot">
              <button type="button" onClick={() => setDrawer(null)} disabled={savingDraft} className={buttonClassName({ variant: "secondary" })}>
                Cancel
              </button>
              {drawer === "new" && (
                <button
                  type="button"
                  onClick={() => void submitDraft(true)}
                  disabled={savingDraft}
                  className={`${buttonClassName({ variant: "secondary" })} depots-v3-soft`}
                >
                  Save &amp; add another
                </button>
              )}
              <button type="submit" disabled={savingDraft} className={buttonClassName()}>
                {savingDraft ? "Saving…" : drawer === "edit" ? "Save changes" : "Save depot"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
