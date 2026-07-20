"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import BarcodeScannerView, {
  type ScannerViewStatus,
} from "@/components/scanner/BarcodeScannerView";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { resolveScannedCode, type ScanResolution } from "@/app/lib/scannerResolve";
import { recordStockMovement } from "@/app/lib/stockMovements";
import { applyScanToStockCountDraft } from "@/app/lib/stockCountDraft";
import { getInventoryQuantityLabel } from "@/app/lib/inventoryItemModel";
import { transferInventoryItemToDepot, isDepotTransferMigrationMissing } from "@/app/lib/depotTransfers";
import {
  recordAssetEvent,
  getAssetsByItem,
  getAssetAssigneeSuggestions,
  isAssetTrackingMigrationMissing,
  type InventoryAsset,
} from "@/app/lib/assetTracking";
import { supabase } from "@/app/lib/supabase";
import {
  FALLBACK_SUBSCRIPTION,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";

interface ScannerItem {
  id: number;
  name: string;
  quantity: number;
  image: string;
  sku?: string | null;
  barcode?: string | null;
  public_id?: string | null;
  item_code?: string | null;
  unit_type?: string | null;
  custom_unit_label?: string | null;
  depot_id?: number | null;
}

interface Depot {
  id: number;
  name: string;
  code: string;
}

interface AssigneeOption {
  name: string;
  count: number;
}

type ScannerMode =
  | "lookup"
  | "receive"
  | "issue"
  | "count"
  | "transfer"
  | "assign"
  | "repair"
  | "return";

interface ModeDefinition {
  id: ScannerMode;
  label: string;
  icon: UiIconName;
  hint: string;
  /** Stages 2 and 3 unlock the remaining modes once their migrations are run. */
  available: boolean;
  unavailableReason?: string;
}

const MODES: ModeDefinition[] = [
  {
    id: "lookup",
    label: "Lookup",
    icon: "search",
    hint: "Scan to open an item.",
    available: true,
  },
  {
    id: "receive",
    label: "Receive",
    icon: "download",
    hint: "Scan to add stock.",
    available: true,
  },
  {
    id: "issue",
    label: "Issue",
    icon: "upload",
    hint: "Scan to remove stock.",
    available: true,
  },
  {
    id: "count",
    label: "Count",
    icon: "layers",
    hint: "Scan to tally an active stock count.",
    available: true,
  },
  {
    id: "transfer",
    label: "Transfer",
    icon: "movement",
    hint: "Move an item to another depot.",
    available: true,
  },
  {
    id: "assign",
    label: "Assign",
    icon: "suppliers",
    hint: "Assign a tracked unit to a person.",
    available: true,
  },
  {
    id: "repair",
    label: "Repair",
    icon: "alert",
    hint: "Send a tracked unit for repair.",
    available: true,
  },
  {
    id: "return",
    label: "Return",
    icon: "check",
    hint: "Return a tracked unit.",
    available: true,
  },
];

const REARM_DELAY_MS = 1200;
const MAX_TAPE_ENTRIES = 8;

interface TapeEntry {
  id: string;
  itemName: string;
  detail: string;
  tone: "success" | "info" | "danger";
  at: string;
}

function isScannerMode(value: string | null): value is ScannerMode {
  return Boolean(value) && MODES.some((mode) => mode.id === value);
}

function describeItemQuantity(item: ScannerItem) {
  return getInventoryQuantityLabel(
    item.quantity,
    item.unit_type,
    item.custom_unit_label
  );
}

function ScannerWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode");

  const [mode, setMode] = useState<ScannerMode>(
    isScannerMode(requestedMode) ? requestedMode : "lookup"
  );
  const [items, setItems] = useState<ScannerItem[]>([]);
  const [subscription, setSubscription] =
    useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Migration status for Stage 2-3 modes
  const [transferMigrationMissing, setTransferMigrationMissing] = useState(false);
  const [assetMigrationMissing, setAssetMigrationMissing] = useState(false);

  // Depots for transfer mode
  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<number | null>(null);

  // Assets and assignees for asset modes
  const [scannedAssets, setScannedAssets] = useState<InventoryAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<AssigneeOption[]>([]);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [selectedCondition, setSelectedCondition] = useState<string>("");

  // `armed` is the user's intent to use the camera at all; `scanning` is
  // whether it should be live right now. The camera only auto-starts when the
  // browser already holds camera permission, so landing on this page never
  // ambushes a first-time user with a permission prompt.
  const [armed, setArmed] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<ScannerViewStatus>({
    starting: false,
    status: "",
    error: "",
  });
  const [resolution, setResolution] = useState<ScanResolution<ScannerItem> | null>(
    null
  );
  const [quantityInput, setQuantityInput] = useState("1");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [tape, setTape] = useState<TapeEntry[]>([]);

  const rearmTimerRef = useRef<number | null>(null);

  const activeMode = MODES.find((entry) => entry.id === mode) || MODES[0];
  const capabilities = getSubscriptionCapabilities(subscription);
  const canUseScanner = capabilities.scanner;

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) throw new Error("Please sign in again to use the scanner.");

        const [
          { data, error },
          loadedSubscription,
          transferMissing,
          assetMissing,
          { data: depotData },
        ] = await Promise.all([
          supabase
            .from("inventory")
            .select(
              "id, name, quantity, image, sku, barcode, public_id, item_code, unit_type, custom_unit_label, depot_id"
            )
            .eq("user_id", user.id)
            .order("name", { ascending: true }),
          getUserSubscription(user.id),
          isDepotTransferMigrationMissing(),
          isAssetTrackingMigrationMissing(),
          supabase
            .from("depots")
            .select("id, name, code")
            .eq("user_id", user.id)
            .order("name", { ascending: true }),
        ]);

        if (error) throw error;
        if (!active) return;

        setItems((data || []) as ScannerItem[]);
        setSubscription(loadedSubscription);
        setTransferMigrationMissing(transferMissing);
        setAssetMigrationMissing(assetMissing);
        setDepots((depotData || []) as Depot[]);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "We could not load the scanner workspace."
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rearmTimerRef.current) window.clearTimeout(rearmTimerRef.current);
    };
  }, []);

  // Auto-arm only when camera permission was already granted. The Permissions
  // API doesn't accept "camera" in every browser (Safari throws), so any
  // failure just leaves the manual Start button in place.
  useEffect(() => {
    let active = true;

    navigator.permissions
      ?.query({ name: "camera" as PermissionName })
      .then((result) => {
        if (active && result.state === "granted") setArmed(true);
      })
      .catch(() => {
        // Manual start remains available.
      });

    return () => {
      active = false;
    };
  }, []);

  const pushTape = useCallback((entry: Omit<TapeEntry, "id" | "at">) => {
    setTape((current) =>
      [
        {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          at: new Date().toLocaleTimeString(),
        },
        ...current,
      ].slice(0, MAX_TAPE_ENTRIES)
    );
  }, []);

  const rearm = useCallback(() => {
    if (rearmTimerRef.current) window.clearTimeout(rearmTimerRef.current);
    rearmTimerRef.current = window.setTimeout(() => {
      setResolution(null);
      setActionError("");
      setQuantityInput("1");
      setScanning(true);
    }, REARM_DELAY_MS);
  }, []);

  const clearResult = useCallback(() => {
    if (rearmTimerRef.current) window.clearTimeout(rearmTimerRef.current);
    setResolution(null);
    setActionError("");
    setQuantityInput("1");
    setScanning(true);
  }, []);

  const loadAssets = useCallback(
    async (itemId: number) => {
      try {
        const assets = await getAssetsByItem(itemId);
        setScannedAssets(assets);
        if (assets.length > 0) {
          setSelectedAssetId(assets[0].id);
        }
      } catch (error: unknown) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Could not load assets for this item."
        );
      }
    },
    []
  );

  const handleDecode = useCallback(
    (text: string) => {
      const next = resolveScannedCode(text, items);
      setActionError("");
      setQuantityInput("1");
      setResolution(next);
      setScanning(false);

      if (next.kind === "item") {
        if (mode === "lookup") {
          pushTape({
            itemName: next.item.name,
            detail: `Opened via ${next.matchedBy.replace("_", " ")}`,
            tone: "info",
          });
          router.push(`/dashboard/inventory/${next.item.id}`);
        } else if (
          mode === "assign" ||
          mode === "repair" ||
          mode === "return"
        ) {
          // Load assets for this item
          void loadAssets(next.item.id);
        }
      }
    },
    [items, mode, pushTape, router, loadAssets]
  );

  const applyStockMovement = useCallback(
    async (item: ScannerItem, direction: "stock_in" | "stock_out") => {
      const parsed = Number(quantityInput);

      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        setActionError("Enter a whole quantity greater than zero.");
        return;
      }

      if (direction === "stock_out" && parsed > item.quantity) {
        setActionError(
          `Only ${describeItemQuantity(item)} in stock. Reduce the quantity.`
        );
        return;
      }

      try {
        setBusy(true);
        setActionError("");

        const movement = await recordStockMovement({
          itemId: item.id,
          movementType: direction,
          quantity: parsed,
          notes:
            direction === "stock_in" ? "Scanner - receive" : "Scanner - issue",
        });

        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, quantity: movement.quantity_after }
              : entry
          )
        );

        pushTape({
          itemName: item.name,
          detail: `${direction === "stock_in" ? "+" : "-"}${parsed} · now ${movement.quantity_after}`,
          tone: "success",
        });
        rearm();
      } catch (error: unknown) {
        setActionError(
          error instanceof Error
            ? error.message
            : "We could not record that stock movement."
        );
      } finally {
        setBusy(false);
      }
    },
    [pushTape, quantityInput, rearm]
  );

  const applyCountScan = useCallback(
    (item: ScannerItem) => {
      const outcome = applyScanToStockCountDraft({
        itemId: item.id,
        expectedQuantity: item.quantity,
      });

      if (!outcome.ok) {
        setActionError(
          outcome.reason === "no-draft"
            ? "No stock count is in progress in this tab. Start one in Stock Counts, then come back."
            : outcome.reason === "finalized"
              ? "That stock count is already finalized. Start a new count to keep scanning."
              : "We could not update the stock count draft in this browser."
        );
        return;
      }

      pushTape({
        itemName: item.name,
        detail: `Counted ${outcome.countedQuantity}${outcome.added ? " (added to count)" : ""}`,
        tone: "success",
      });
      rearm();
    },
    [pushTape, rearm]
  );

  const applyTransfer = useCallback(
    async (item: ScannerItem) => {
      if (!selectedDepot) {
        setActionError("Select a destination depot.");
        return;
      }

      if (selectedDepot === item.depot_id) {
        setActionError("Item is already in the selected depot.");
        return;
      }

      try {
        setBusy(true);
        setActionError("");

        await transferInventoryItemToDepot(
          item.id,
          selectedDepot,
          "Scanner",
          undefined
        );

        const newDepotName =
          depots.find((d) => d.id === selectedDepot)?.name || "Unknown";

        pushTape({
          itemName: item.name,
          detail: `Moved to ${newDepotName}`,
          tone: "success",
        });

        setSelectedDepot(null);
        rearm();
      } catch (error: unknown) {
        setActionError(
          error instanceof Error ? error.message : "Transfer failed."
        );
      } finally {
        setBusy(false);
      }
    },
    [selectedDepot, depots, pushTape, rearm]
  );

  const applyAssetEvent = useCallback(
    async (
      assetId: number,
      eventType: "status_changed" | "condition_changed" | "assigned" | "unassigned"
    ) => {
      try {
        setBusy(true);
        setActionError("");

        let newStatus: "in_stock" | "in_use" | "in_repair" | "retired" | "lost" | undefined;
        let newCondition: "good" | "fair" | "poor" | "damaged" | "unknown" | undefined;
        let newAssignedTo: string | undefined;

        if (eventType === "status_changed" && mode === "repair") {
          newStatus = "in_repair";
        } else if (eventType === "status_changed" && mode === "return") {
          newStatus = "in_stock";
        } else if (eventType === "condition_changed") {
          newCondition = (selectedCondition as "good" | "fair" | "poor" | "damaged" | "unknown" | "") || undefined;
        } else if (eventType === "assigned" && mode === "assign") {
          newAssignedTo = assigneeInput;
        }

        await recordAssetEvent(
          assetId,
          eventType,
          newStatus,
          newCondition,
          newAssignedTo,
          undefined,
          "Scanner"
        );

        const asset = scannedAssets.find((a) => a.id === assetId);
        const itemName =
          scannedAssets.length > 0
            ? items.find((i) => i.id === asset?.inventory_item_id)?.name || "Item"
            : "Item";
        const detail =
          mode === "assign"
            ? `Assigned to ${assigneeInput}`
            : mode === "repair"
              ? "Marked for repair"
              : mode === "return"
                ? "Returned to stock"
                : "Updated";

        pushTape({
          itemName,
          detail,
          tone: "success",
        });

        setSelectedDepot(null);
        setAssigneeInput("");
        setSelectedCondition("");
        rearm();
      } catch (error: unknown) {
        setActionError(
          error instanceof Error ? error.message : "Asset event failed."
        );
      } finally {
        setBusy(false);
      }
    },
    [mode, selectedCondition, assigneeInput, scannedAssets, pushTape, rearm, items]
  );

  const updateAssigneeSuggestions = useCallback(
    async (query: string) => {
      setAssigneeInput(query);
      if (query.length > 0) {
        try {
          const suggestions = await getAssetAssigneeSuggestions(query);
          setAssigneeSuggestions(suggestions);
        } catch {
          setAssigneeSuggestions([]);
        }
      } else {
        setAssigneeSuggestions([]);
      }
    },
    []
  );

  const modeChips = useMemo(
    () =>
      MODES.map((entry) => {
        // Determine availability based on migration status
        let available = entry.available;
        let unavailableReason = entry.unavailableReason;

        if (entry.id === "transfer" && transferMigrationMissing) {
          available = false;
          unavailableReason =
            "Transfer needs the depot-transfer database setup. Ask your admin to run the phase-10a migration.";
        }
        if (
          (entry.id === "assign" || entry.id === "repair" || entry.id === "return") &&
          assetMigrationMissing
        ) {
          available = false;
          unavailableReason =
            "Asset modes need the asset-tracking database setup. Ask your admin to run the phase-10b migration.";
        }

        const selected = entry.id === mode;
        return (
          <button
            key={entry.id}
            type="button"
            aria-pressed={selected}
            title={available ? entry.hint : unavailableReason}
            onClick={() => {
              if (!available) {
                setActionError(unavailableReason || "");
                return;
              }
              setMode(entry.id);
              clearResult();
            }}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
              selected
                ? "border-[#2563eb]/50 bg-[#2563eb]/12 text-theme-accent ring-4 ring-[#2563eb]/15"
                : available
                  ? "border-theme bg-theme-surface text-theme-secondary hover:bg-theme-hover hover:text-theme-primary"
                  : "cursor-not-allowed border-theme bg-theme-inset text-theme-subtle opacity-60"
            }`}
          >
            <UiIcon name={entry.icon} className="h-4 w-4" />
            {entry.label}
            {!available && (
              <span className="rounded-full border border-theme bg-theme-surface px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em]">
                Soon
              </span>
            )}
          </button>
        );
      }),
    [clearResult, mode, transferMigrationMissing, assetMigrationMissing]
  );

  if (loading) {
    return (
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Operations"
          title="Scanner"
          description="Scan a code, then choose what to do with it."
        />
        <LoadingSkeletonGroup count={3} itemClassName="min-h-32" />
      </DashboardPageShell>
    );
  }

  if (loadError) {
    return (
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Operations"
          title="Scanner"
          description="Scan a code, then choose what to do with it."
        />
        <DashboardNotice tone="danger">{loadError}</DashboardNotice>
      </DashboardPageShell>
    );
  }

  if (!canUseScanner) {
    return (
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Operations"
          title="Scanner"
          description="Scan a code, then choose what to do with it."
        />
        <LockedFeaturePanel
          feature="Scanner workspace"
          benefit="Scan SydIN QR codes and product barcodes to look up items, receive and issue stock, and run counts hands-free."
          currentPlan="Free"
          requiredPlan="Standard"
          source="scanner-workspace"
        />
      </DashboardPageShell>
    );
  }

  const scannedItem =
    resolution?.kind === "item" ? resolution.item : null;

  return (
    <DashboardPageShell>
      <DashboardPageHeader
        eyebrow="Operations"
        title="Scanner"
        description={activeMode.hint}
        actions={
          <Link
            href="/dashboard/inventory"
            className="dashboard-action-button dashboard-action-button-secondary"
          >
            Inventory
          </Link>
        }
      />

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Scanner mode"
      >
        {modeChips}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <section className="dashboard-card overflow-hidden p-0">
          {armed ? (
            <BarcodeScannerView
              active={scanning}
              continuous
              onDecode={handleDecode}
              onStatusChange={setCameraStatus}
              readyStatus="Point the camera at a QR code or barcode."
              className="bg-black"
              videoClassName="aspect-[3/4] w-full bg-black object-cover sm:aspect-video"
            />
          ) : (
            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-4 bg-theme-inset px-6 text-center sm:aspect-video">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2563eb]/25 bg-[#2563eb]/10 text-theme-accent">
                <UiIcon name="scan" className="h-6 w-6" />
              </span>
              <div>
                <p className="text-base font-black text-theme-primary">
                  Ready to scan
                </p>
                <p className="mt-1 text-sm leading-6 text-theme-muted">
                  Your browser will ask for camera access the first time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setArmed(true);
                  setScanning(true);
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110"
              >
                <UiIcon name="scan" className="h-4 w-4" />
                Start scanning
              </button>
            </div>
          )}

          <div
            className="border-t border-theme px-4 py-3"
            role="status"
            aria-live="polite"
          >
            {!armed ? (
              <p className="text-sm font-semibold text-theme-secondary">
                Camera is off.
              </p>
            ) : cameraStatus.error ? (
              <p className="text-sm font-semibold text-theme-danger">
                {cameraStatus.error}
              </p>
            ) : !scanning ? (
              <p className="text-sm font-semibold text-theme-secondary">
                Paused — finish the action below to scan again.
              </p>
            ) : (
              <p className="text-sm font-semibold text-theme-secondary">
                {cameraStatus.starting
                  ? "Starting camera..."
                  : cameraStatus.status || "Point the camera at a code."}
              </p>
            )}
          </div>
        </section>

        <div className="grid content-start gap-4">
          <section className="dashboard-card">
            <h2 className="text-lg font-black text-theme-primary">
              {activeMode.label}
            </h2>

            {actionError && (
              <DashboardNotice tone="danger" className="mt-3">
                {actionError}
              </DashboardNotice>
            )}

            {!resolution && (
              <p className="mt-3 text-sm leading-6 text-theme-muted">
                {activeMode.hint} Scanned results appear here.
              </p>
            )}

            {resolution?.kind === "none" && (
              <DashboardEmptyState
                className="mt-3"
                icon="search"
                title="No matching item"
                description={`Nothing matched “${resolution.query}”. Check the code, or find the item in Inventory.`}
                action={
                  <ActionButton onClick={clearResult} icon="scan">
                    Scan again
                  </ActionButton>
                }
              />
            )}

            {resolution?.kind === "ambiguous" && (
              <div className="mt-3 grid gap-2">
                <p className="text-sm font-semibold text-theme-secondary">
                  {resolution.items.length} items share that code. Pick one:
                </p>
                {resolution.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setResolution({ kind: "item", item, matchedBy: "sku" })
                    }
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-theme bg-theme-surface px-3 py-2.5 text-left transition hover:bg-theme-hover"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-theme-primary">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs text-theme-subtle">
                        {item.item_code || item.sku || "No identifier"}
                      </span>
                    </span>
                    <UiIcon
                      name="chevron-right"
                      className="h-4 w-4 shrink-0 text-theme-subtle"
                    />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearResult}
                  className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover"
                >
                  Scan again
                </button>
              </div>
            )}

            {scannedItem && (
              <div className="mt-3 grid gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-theme bg-theme-inset p-3">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-theme-surface ring-1 ring-black/5">
                    {scannedItem.image ? (
                      <Image
                        src={scannedItem.image}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <UiIcon name="box" className="h-5 w-5 text-theme-subtle" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-theme-primary">
                      {scannedItem.name}
                    </span>
                    <span className="block truncate text-xs font-semibold text-theme-muted">
                      {describeItemQuantity(scannedItem)} in stock
                    </span>
                  </span>
                </div>

                {(mode === "receive" || mode === "issue") && (
                  <>
                    <label className="grid gap-1.5 text-sm font-bold text-theme-secondary">
                      Quantity to {mode === "receive" ? "add" : "remove"}
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={quantityInput}
                        onChange={(event) => {
                          setQuantityInput(event.target.value);
                          setActionError("");
                        }}
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-base text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                      />
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={clearResult}
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void applyStockMovement(
                            scannedItem,
                            mode === "receive" ? "stock_in" : "stock_out"
                          )
                        }
                        className="min-h-11 rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy
                          ? "Saving..."
                          : mode === "receive"
                            ? "Add stock"
                            : "Remove stock"}
                      </button>
                    </div>
                  </>
                )}

                {mode === "count" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={clearResult}
                      className="min-h-11 rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCountScan(scannedItem)}
                      className="min-h-11 rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110"
                    >
                      Count 1
                    </button>
                  </div>
                )}

                {mode === "lookup" && (
                  <Link
                    href={`/dashboard/inventory/${scannedItem.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110"
                  >
                    Open item
                  </Link>
                )}

                {mode === "transfer" && (
                  <>
                    <label className="grid gap-1.5 text-sm font-bold text-theme-secondary">
                      Destination depot
                      <select
                        value={selectedDepot || ""}
                        onChange={(e) =>
                          setSelectedDepot(e.target.value ? Number(e.target.value) : null)
                        }
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-base text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                      >
                        <option value="">Choose a depot...</option>
                        {depots.map((depot) => (
                          <option key={depot.id} value={depot.id}>
                            {depot.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={clearResult}
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy || !selectedDepot}
                        onClick={() => applyTransfer(scannedItem)}
                        className="min-h-11 rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy ? "Moving..." : "Move to depot"}
                      </button>
                    </div>
                  </>
                )}

                {mode === "assign" && scannedAssets.length > 0 && (
                  <>
                    <label className="grid gap-1.5 text-sm font-bold text-theme-secondary">
                      Select unit to assign
                      <select
                        value={selectedAssetId || ""}
                        onChange={(e) => setSelectedAssetId(Number(e.target.value))}
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-base text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                      >
                        {scannedAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.public_id}{" "}
                            {asset.assigned_to_name ? `(${asset.assigned_to_name})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-bold text-theme-secondary">
                      Assign to
                      <input
                        type="text"
                        list="assignee-suggestions"
                        value={assigneeInput}
                        onChange={(e) => updateAssigneeSuggestions(e.target.value)}
                        placeholder="Name or email..."
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-base text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                      />
                      {assigneeSuggestions.length > 0 && (
                        <datalist id="assignee-suggestions">
                          {assigneeSuggestions.map((suggestion) => (
                            <option key={suggestion.name} value={suggestion.name} />
                          ))}
                        </datalist>
                      )}
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={clearResult}
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy || !assigneeInput}
                        onClick={() =>
                          selectedAssetId &&
                          applyAssetEvent(selectedAssetId, "assigned")
                        }
                        className="min-h-11 rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy ? "Assigning..." : "Assign unit"}
                      </button>
                    </div>
                  </>
                )}

                {mode === "repair" && scannedAssets.length > 0 && (
                  <>
                    <label className="grid gap-1.5 text-sm font-bold text-theme-secondary">
                      Unit to send for repair
                      <select
                        value={selectedAssetId || ""}
                        onChange={(e) => setSelectedAssetId(Number(e.target.value))}
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-base text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                      >
                        {scannedAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.public_id} (Current: {asset.condition || "unknown"})
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={clearResult}
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          selectedAssetId &&
                          applyAssetEvent(selectedAssetId, "status_changed")
                        }
                        className="min-h-11 rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy ? "Marking..." : "Mark for repair"}
                      </button>
                    </div>
                  </>
                )}

                {mode === "return" && scannedAssets.length > 0 && (
                  <>
                    <label className="grid gap-1.5 text-sm font-bold text-theme-secondary">
                      Unit to return
                      <select
                        value={selectedAssetId || ""}
                        onChange={(e) => setSelectedAssetId(Number(e.target.value))}
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-inset px-3 text-base text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
                      >
                        {scannedAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.public_id} (Status: {asset.status})
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={clearResult}
                        disabled={busy}
                        className="min-h-11 rounded-xl border border-theme bg-theme-surface px-4 py-2.5 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          selectedAssetId &&
                          applyAssetEvent(selectedAssetId, "status_changed")
                        }
                        className="min-h-11 rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy ? "Returning..." : "Return to stock"}
                      </button>
                    </div>
                  </>
                )}

                {(mode === "assign" || mode === "repair" || mode === "return") &&
                  scannedAssets.length === 0 && (
                    <DashboardEmptyState
                      icon="box"
                      title="No tracked units"
                      description="This item doesn't have any tracked units yet. You'll need to create assets first."
                    />
                  )}
              </div>
            )}
          </section>

          <section className="dashboard-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-theme-primary">
                This session
              </h2>
              {tape.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTape([])}
                  className="rounded-lg border border-theme bg-theme-surface px-2.5 py-1.5 text-xs font-bold text-theme-secondary transition hover:bg-theme-hover"
                >
                  Clear
                </button>
              )}
            </div>

            {tape.length === 0 ? (
              <p className="mt-3 text-sm text-theme-muted">
                Scans you complete in this session are listed here.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {tape.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-theme bg-theme-inset px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-theme-primary">
                        {entry.itemName}
                      </span>
                      <span className="block truncate text-xs text-theme-muted">
                        {entry.detail}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-theme-subtle">
                      {entry.at}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </DashboardPageShell>
  );
}

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <DashboardPageShell>
          <LoadingSkeletonGroup count={3} itemClassName="min-h-32" />
        </DashboardPageShell>
      }
    >
      <ScannerWorkspace />
    </Suspense>
  );
}
