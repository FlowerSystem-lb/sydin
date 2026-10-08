"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { useRouter, useSearchParams } from "next/navigation";
import { buttonClassName, DialogShell, StatusBadge, useToast } from "@/components/ui";
import ProductThumbnail from "@/components/inventory/ProductThumbnail";
import UiIcon from "@/components/UiIcon";
import BarcodeScannerView, {
  type ScannerViewStatus,
} from "@/components/scanner/BarcodeScannerView";
import { useDevicePairing, PHONE_OFFLINE_AFTER_MS } from "@/components/scanner/useDevicePairing";
import { useScanSound } from "@/components/scanner/useScanSound";
import { useKeyboardWedge } from "@/components/scanner/useKeyboardWedge";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import {
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import {
  extractScannedPublicId,
  resolveScannedCode,
  type ScanResolution,
} from "@/app/lib/scannerResolve";
import {
  SCANNER_MODES,
  describeMatch,
  getScannerMode,
  isScannerMode,
  type ScannerMode,
} from "@/app/lib/scannerModes";
import { getPairingBaseUrl, setPairingVibrate } from "@/app/lib/devicePairing";
import { recordStockMovement } from "@/app/lib/stockMovements";
import { applyScanToStockCountDraft } from "@/app/lib/stockCountDraft";
import {
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
} from "@/app/lib/inventoryItemModel";
import { transferInventoryItemToDepot, isDepotTransferMigrationMissing } from "@/app/lib/depotTransfers";
import {
  recordAssetEvent,
  getAssetsByItem,
  getAssetAssigneeSuggestions,
  isAssetTrackingMigrationMissing,
  type InventoryAsset,
} from "@/app/lib/assetTracking";
import { formatExactPrice, getCurrencyContext } from "@/app/lib/currency";
import { supabase } from "@/app/lib/supabase";
import { getBusinessUser } from "@/app/lib/business";
import {
  FALLBACK_SUBSCRIPTION,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";

/*
 * Scanner (redesign 8 Oct 2026, Sayed's spec + screenshots).
 *
 * One page, three ways in -- this camera, a linked phone, a USB scanner --
 * plus a typed code, and every one of them goes through `handleScan`, so a
 * code resolves and behaves the same whichever way it arrived. The eight
 * modes and their save logic (stock movement, count draft, transfer, asset
 * events) are unchanged from the previous Scanner Workspace.
 */

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
  min_stock_level?: number | null;
  selling_price?: number | string | null;
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

type ScanSource = "camera" | "phone" | "usb" | "manual";

type Resolution =
  | ScanResolution<ScannerItem>
  | { kind: "external"; url: string };

interface LastScan {
  resolution: Resolution;
  raw: string;
  source: ScanSource;
  at: number;
}

interface SessionEntry {
  id: string;
  ok: boolean;
  title: string;
  code: string;
  how: string;
  mode: string;
  at: number;
}

interface ScannerSettings {
  sound: boolean;
  vibrate: boolean;
  autoOpen: boolean;
  continuous: boolean;
  allowRepeats: boolean;
}

const SETTINGS_KEY = "sydin:scanner-settings";
const SOURCE_KEY = "sydin:scanner-source";
const HISTORY_KEY = "sydin:scanner-history";
const HISTORY_LIMIT = 200;
const REPEAT_WINDOW_MS = 2_000;
const AUTO_OPEN_DELAY_MS = 600;
const PAIR_CODE_LIFETIME_MS = 10 * 60 * 1000;

const DEFAULT_SETTINGS: ScannerSettings = {
  sound: true,
  vibrate: true,
  autoOpen: true,
  continuous: true,
  allowRepeats: false,
};

const SOURCE_LABEL: Record<ScanSource, string> = {
  camera: "camera",
  phone: "phone",
  usb: "USB scanner",
  manual: "typed",
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered; the page still works.
  }
}

function readHistory(): SessionEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as SessionEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAgo(at: number, now: number) {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 20) return "just now";
  if (seconds < 90) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

function describeItemQuantity(item: ScannerItem) {
  return getInventoryQuantityLabel(item.quantity, item.unit_type, item.custom_unit_label);
}

/** Our own item link that did not match any item is "unknown", not external. */
function isOwnLink(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const ownHosts = new Set(["sydin.site", "sydin.vercel.app", "localhost", "127.0.0.1"]);
    if (typeof window !== "undefined") ownHosts.add(window.location.hostname.replace(/^www\./, ""));
    return ownHosts.has(host);
  } catch {
    return false;
  }
}

function resolveRaw(raw: string, items: ScannerItem[]): Resolution {
  const resolved = resolveScannedCode(raw, items);
  if (resolved.kind !== "none") return resolved;
  if (/^https?:\/\//i.test(raw) && !(isOwnLink(raw) && extractScannedPublicId(raw))) {
    return { kind: "external", url: raw };
  }
  return resolved;
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function ScannerWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const { showToast } = useToast();

  const [mode, setMode] = useState<ScannerMode>(
    isScannerMode(requestedMode) ? requestedMode : "lookup"
  );
  const [items, setItems] = useState<ScannerItem[]>([]);
  const [subscription, setSubscription] =
    useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [storedLowStock, setStoredLowStock] = useState(5);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Migration status for Stage 2-3 modes
  const [transferMigrationMissing, setTransferMigrationMissing] = useState(false);
  const [assetMigrationMissing, setAssetMigrationMissing] = useState(false);

  // Depots for transfer mode
  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<number | null>(null);
  const [userId, setUserId] = useState("");

  // Assets and assignees for asset modes
  const [scannedAssets, setScannedAssets] = useState<InventoryAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<AssigneeOption[]>([]);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [selectedCondition, setSelectedCondition] = useState<string>("");

  // Where scans come from, and the per-browser settings.
  const [source, setSource] = useState<Exclude<ScanSource, "manual">>("camera");
  const [settings, setSettings] = useState<ScannerSettings>(DEFAULT_SETTINGS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

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
  const [cameraName, setCameraName] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [torchTrack, setTorchTrack] = useState<MediaStreamTrack | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [flash, setFlash] = useState(false);

  const [last, setLast] = useState<LastScan | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [session, setSession] = useState<SessionEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SessionEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const lastRawRef = useRef<{ raw: string; at: number } | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const openTimerRef = useRef<number | null>(null);

  const activeMode = getScannerMode(mode);
  const capabilities = getSubscriptionCapabilities(subscription);
  const canUseScanner = capabilities.scanner;
  const play = useScanSound({ enabled: settings.sound });

  /* ---------------- load ---------------- */

  useEffect(() => {
    let active = true;

    getBusinessUser()
      .then(async ({ data: { user } }) => {
        if (!user) throw new Error("Please sign in again to use the scanner.");

        if (active) setUserId(user.id);

        const [
          { data, error },
          loadedSubscription,
          transferMissing,
          assetMissing,
          { data: depotData },
          { data: settingsRow },
        ] = await Promise.all([
          supabase
            .from("inventory")
            .select(
              "id, name, quantity, image, sku, barcode, public_id, item_code, unit_type, custom_unit_label, depot_id, min_stock_level, selling_price"
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
          supabase
            .from("business_settings")
            .select("low_stock_threshold")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (error) throw error;
        if (!active) return;

        setItems((data || []) as ScannerItem[]);
        setSubscription(loadedSubscription);
        setTransferMigrationMissing(transferMissing);
        setAssetMigrationMissing(assetMissing);
        setDepots((depotData || []) as Depot[]);
        const threshold = Number((settingsRow as { low_stock_threshold?: number } | null)?.low_stock_threshold);
        if (Number.isFinite(threshold)) setStoredLowStock(threshold);
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

  // Per-browser preferences: settings, last source.
  useEffect(() => {
    const savedSource = (() => {
      try {
        return window.localStorage.getItem(SOURCE_KEY);
      } catch {
        return null;
      }
    })();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of browser-stored preferences after mount */
    setSettings(readJson(SETTINGS_KEY, DEFAULT_SETTINGS));
    if (savedSource === "phone" || savedSource === "usb" || savedSource === "camera") setSource(savedSource);
    setPrefsLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const updateSetting = (key: keyof ScannerSettings, value: boolean) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      writeJson(SETTINGS_KEY, next);
      return next;
    });
  };

  const chooseSource = (next: Exclude<ScanSource, "manual">) => {
    setSource(next);
    try {
      window.localStorage.setItem(SOURCE_KEY, next);
    } catch {
      // Not remembered.
    }
  };

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    };
  }, []);

  // "just now" / "2 min ago" labels.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
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

  /* ---------------- scan handling ---------------- */

  const loadAssets = useCallback(async (itemId: number) => {
    try {
      const assets = await getAssetsByItem(itemId);
      setScannedAssets(assets);
      if (assets.length > 0) {
        setSelectedAssetId(assets[0].id);
      }
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : "Could not load assets for this item."
      );
    }
  }, []);

  const addSessionEntry = useCallback((entry: Omit<SessionEntry, "id" | "at">) => {
    const full: SessionEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
    };
    setSession((current) => [full, ...current].slice(0, 100));
    writeJson(HISTORY_KEY, [full, ...readHistory()].slice(0, HISTORY_LIMIT));
  }, []);

  const showFlash = useCallback(() => {
    setFlash(true);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(false), 320);
  }, []);

  const handleScan = useCallback(
    (rawInput: string, from: ScanSource) => {
      const raw = rawInput.trim();
      if (!raw) return;

      const at = Date.now();
      const previous = lastRawRef.current;
      if (!settings.allowRepeats && previous && previous.raw === raw && at - previous.at < REPEAT_WINDOW_MS) {
        play("duplicate");
        return;
      }
      lastRawRef.current = { raw, at };

      const resolution = resolveRaw(raw, items);
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
      setActionError("");
      setQuantityInput("1");
      setScannedAssets([]);
      setLast({ resolution, raw, source: from, at });

      const how = `via ${resolution.kind === "item" ? describeMatch(resolution.matchedBy) : SOURCE_LABEL[from]}`;

      if (resolution.kind === "item") {
        const item = resolution.item;
        play("success");
        showFlash();
        addSessionEntry({
          ok: true,
          title: item.name,
          code: item.item_code || item.sku || item.barcode || raw,
          how,
          mode: activeMode.label,
        });
        showToast({ tone: "success", message: `Found ${item.name}` });

        if (mode === "lookup") {
          if (settings.autoOpen) {
            // A beat for the beep and the green flash to register.
            openTimerRef.current = window.setTimeout(() => {
              router.push(`/dashboard/inventory/${item.id}?returnTo=${encodeURIComponent("/dashboard/scanner")}`);
            }, AUTO_OPEN_DELAY_MS);
          }
        } else {
          if (!settings.continuous) setScanning(false);
          if (mode === "assign" || mode === "repair" || mode === "return") {
            void loadAssets(item.id);
          }
        }
        return;
      }

      if (resolution.kind === "ambiguous") {
        play("success");
        showFlash();
        if (!settings.continuous) setScanning(false);
        addSessionEntry({
          ok: true,
          title: `${resolution.items.length} items share this code`,
          code: raw,
          how,
          mode: activeMode.label,
        });
        showToast({ tone: "info", message: `${resolution.items.length} items share that code. Pick one.` });
        return;
      }

      play("error");
      if (resolution.kind === "external") {
        addSessionEntry({ ok: false, title: "Outside link", code: raw, how, mode: activeMode.label });
        showToast({ tone: "info", message: "That is a link outside SydIN. It was not opened." });
        return;
      }

      addSessionEntry({ ok: false, title: "Unknown code", code: raw, how: "not in SydIN", mode: activeMode.label });
      showToast({ tone: "danger", message: "Unknown code" });
    },
    [activeMode.label, addSessionEntry, items, loadAssets, mode, play, router, settings, showFlash, showToast]
  );

  /* ---------------- phone link ---------------- */

  const { pairing, loading: pairingLoading, scanCount: phoneScanCount, startPairing, disconnect, changeMode: syncPhoneMode } =
    useDevicePairing({
      userId: canUseScanner ? userId : "",
      autoCreate: prefsLoaded && source === "phone",
      onBarcodeReceived: (raw) => handleScan(raw, "phone"),
      onModeChange: (next) => {
        if (isScannerMode(next)) setMode(next);
      },
    });

  // The phone reads the "Vibrate phone" switch on its next heartbeat.
  const pairingRowId = pairing?.id;
  useEffect(() => {
    if (pairingRowId && prefsLoaded) void setPairingVibrate(pairingRowId, settings.vibrate);
  }, [pairingRowId, prefsLoaded, settings.vibrate]);

  const phoneLinked = pairing?.status === "paired";
  const phoneLastSeen = pairing?.last_seen_at ? new Date(pairing.last_seen_at).getTime() : 0;
  const phoneOnline = phoneLinked && now - phoneLastSeen < PHONE_OFFLINE_AFTER_MS;
  const pairExpiresAt = pairing?.status === "waiting" ? new Date(pairing.created_at).getTime() + PAIR_CODE_LIFETIME_MS : 0;
  const pairSecondsLeft = pairExpiresAt ? Math.max(0, Math.round((pairExpiresAt - now) / 1000)) : 0;
  const pairUrl = pairing?.pair_token ? `${getPairingBaseUrl()}/pair/${pairing.pair_token}` : "";

  /* ---------------- USB scanner ---------------- */

  useKeyboardWedge({
    enabled: !loading && canUseScanner && !historyOpen,
    onCode: (code) => handleScan(code, "usb"),
  });

  /* ---------------- camera extras ---------------- */

  const handleStream = useCallback((stream: MediaStream | null) => {
    const track = stream?.getVideoTracks()[0] || null;
    setCameraName(track?.label?.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "") || "");
    const caps = (track?.getCapabilities?.() || {}) as MediaTrackCapabilities & { torch?: boolean };
    setTorchTrack(track && caps.torch ? track : null);
    if (!track) {
      setTorchOn(false);
      return;
    }
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => setCameras(devices.filter((device) => device.kind === "videoinput")))
      .catch(() => {});
  }, []);

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex((camera) => camera.deviceId === deviceId);
    const next = cameras[(currentIndex + 1) % cameras.length];
    setDeviceId(next.deviceId);
  };

  const toggleTorch = async () => {
    if (!torchTrack) return;
    try {
      await torchTrack.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch {
      setTorchTrack(null);
    }
  };

  /* ---------------- mode actions (unchanged save logic) ---------------- */

  const rearm = useCallback(() => {
    setScanning(true);
  }, []);

  const clearResult = useCallback(() => {
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    setLast(null);
    setActionError("");
    setQuantityInput("1");
    setScanning(true);
  }, []);

  const applyStockMovement = useCallback(
    async (item: ScannerItem, direction: "stock_in" | "stock_out") => {
      const parsed = Number(quantityInput);

      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        setActionError("Enter a whole quantity greater than zero.");
        return;
      }

      if (direction === "stock_out" && parsed > item.quantity) {
        setActionError(`Only ${describeItemQuantity(item)} in stock. Reduce the quantity.`);
        return;
      }

      try {
        setBusy(true);
        setActionError("");

        const movement = await recordStockMovement({
          itemId: item.id,
          movementType: direction,
          quantity: parsed,
          notes: direction === "stock_in" ? "Scanner - receive" : "Scanner - issue",
        });

        const updated = { ...item, quantity: movement.quantity_after };
        setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
        setLast((current) =>
          current && current.resolution.kind === "item"
            ? { ...current, resolution: { ...current.resolution, item: updated } }
            : current
        );

        showToast({
          tone: "success",
          message: `${direction === "stock_in" ? "Receive" : "Issue"} · ${item.name} ${direction === "stock_in" ? "+" : "−"}${parsed}`,
        });
        setQuantityInput("1");
        rearm();
      } catch (error: unknown) {
        setActionError(error instanceof Error ? error.message : "We could not record that stock movement.");
      } finally {
        setBusy(false);
      }
    },
    [quantityInput, rearm, showToast]
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

      showToast({
        tone: "success",
        message: `Count · ${item.name} ${outcome.countedQuantity}${outcome.added ? " (added to count)" : ""}`,
      });
      rearm();
    },
    [rearm, showToast]
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

        await transferInventoryItemToDepot(item.id, selectedDepot, "Scanner", undefined);

        const newDepotName = depots.find((d) => d.id === selectedDepot)?.name || "Unknown";
        const updated = { ...item, depot_id: selectedDepot };
        setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
        setLast((current) =>
          current && current.resolution.kind === "item"
            ? { ...current, resolution: { ...current.resolution, item: updated } }
            : current
        );

        showToast({ tone: "success", message: `Transfer · ${item.name} to ${newDepotName}` });
        setSelectedDepot(null);
        rearm();
      } catch (error: unknown) {
        setActionError(error instanceof Error ? error.message : "Transfer failed.");
      } finally {
        setBusy(false);
      }
    },
    [selectedDepot, depots, rearm, showToast]
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

        await recordAssetEvent(assetId, eventType, newStatus, newCondition, newAssignedTo, undefined, "Scanner");

        const asset = scannedAssets.find((a) => a.id === assetId);
        const itemName = items.find((i) => i.id === asset?.inventory_item_id)?.name || "Item";
        const detail =
          mode === "assign"
            ? `assigned to ${assigneeInput}`
            : mode === "repair"
              ? "marked for repair"
              : mode === "return"
                ? "returned to stock"
                : "updated";

        showToast({ tone: "success", message: `${itemName} ${detail}` });

        setSelectedDepot(null);
        setAssigneeInput("");
        setSelectedCondition("");
        rearm();
      } catch (error: unknown) {
        setActionError(error instanceof Error ? error.message : "Asset event failed.");
      } finally {
        setBusy(false);
      }
    },
    [mode, selectedCondition, assigneeInput, scannedAssets, rearm, items, showToast]
  );

  const updateAssigneeSuggestions = useCallback(async (query: string) => {
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
  }, []);

  /* ---------------- modes ---------------- */

  const modeAvailability = useMemo(() => {
    const map = new Map<ScannerMode, string>();
    if (transferMigrationMissing) {
      map.set(
        "transfer",
        "Transfer needs the depot-transfer database setup. Ask your admin to run the phase-10a migration."
      );
    }
    if (assetMigrationMissing) {
      const reason =
        "Asset modes need the asset-tracking database setup. Ask your admin to run the phase-10b migration.";
      map.set("assign", reason);
      map.set("repair", reason);
      map.set("return", reason);
    }
    return map;
  }, [transferMigrationMissing, assetMigrationMissing]);

  const chooseMode = (next: ScannerMode) => {
    const blocked = modeAvailability.get(next);
    if (blocked) {
      setActionError(blocked);
      return;
    }
    setMode(next);
    syncPhoneMode(next);
    clearResult();
  };

  /* ---------------- session export ---------------- */

  const exportCsv = () => {
    const rows = [
      ["Time", "Item", "Code", "How", "Mode", "Result"],
      ...session.map((entry) => [
        new Date(entry.at).toLocaleString(),
        entry.title,
        entry.code,
        entry.how,
        entry.mode,
        entry.ok ? "Found" : "Not found",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => csvCell(String(cell))).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `sydin-scans-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sessionItemCount = useMemo(
    () => new Set(session.filter((entry) => entry.ok).map((entry) => entry.code)).size,
    [session]
  );

  /* ---------------- early states ---------------- */

  const header = (
    <DashboardPageHeader
      eyebrow="Operations"
      title="Scanner"
      description="Scan QR codes and barcodes with this camera, your phone or a USB scanner."
      actions={
        canUseScanner && !loading && !loadError ? (
          <div className="scanner-v2-head-actions">
            <button
              type="button"
              onClick={() => updateSetting("sound", !settings.sound)}
              aria-pressed={settings.sound}
              className={`scanner-v2-sound ${settings.sound ? "is-on" : ""}`}
            >
              <UiIcon name={settings.sound ? "volume" : "volume-off"} className="h-4 w-4" />
              {settings.sound ? "Sound on" : "Sound off"}
            </button>
            <button
              type="button"
              onClick={() => {
                setHistory(readHistory());
                setHistoryOpen(true);
              }}
              className={buttonClassName({ variant: "secondary" })}
            >
              Scan history
            </button>
          </div>
        ) : undefined
      }
    />
  );

  if (loading) {
    return (
      <DashboardPageShell as="main">
        {header}
        <LoadingSkeletonGroup count={3} itemClassName="min-h-32" />
      </DashboardPageShell>
    );
  }

  if (loadError) {
    return (
      <DashboardPageShell as="main">
        {header}
        <DashboardNotice tone="danger">{loadError}</DashboardNotice>
      </DashboardPageShell>
    );
  }

  if (!canUseScanner) {
    return (
      <DashboardPageShell as="main">
        {header}
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

  /* ---------------- derived for render ---------------- */

  const resolution = last?.resolution || null;
  const scannedItem = resolution?.kind === "item" ? resolution.item : null;
  const effectiveLowStock = getEffectiveLowStockThreshold(subscription, storedLowStock);
  const minFor = (item: ScannerItem) =>
    capabilities.customLowStockThreshold
      ? getEffectiveItemLowStockThreshold(item.min_stock_level, effectiveLowStock)
      : effectiveLowStock;
  const depotName = (item: ScannerItem) =>
    depots.find((depot) => depot.id === item.depot_id)?.name || "Unassigned";
  const priceLabel = (item: ScannerItem) => {
    const value = item.selling_price === null || item.selling_price === undefined || item.selling_price === ""
      ? null
      : Number(item.selling_price);
    return formatExactPrice(value, getCurrencyContext().base) || "—";
  };

  const statusPill =
    source === "camera"
      ? !armed
        ? { tone: "idle", label: "Camera off" }
        : cameraStatus.error
          ? { tone: "danger", label: "Camera blocked" }
          : !scanning
            ? { tone: "idle", label: "Paused" }
            : { tone: "success", label: cameraStatus.starting ? "Starting…" : "Camera live" }
      : source === "phone"
        ? phoneLinked
          ? phoneOnline
            ? { tone: "success", label: "Phone connected" }
            : { tone: "warning", label: "Phone disconnected" }
          : { tone: "warning", label: "Waiting for phone" }
        : { tone: "success", label: "Listening for scanner" };

  const cancelButton = (
    <button type="button" onClick={clearResult} disabled={busy} className={buttonClassName({ variant: "secondary" })}>
      Cancel
    </button>
  );

  return (
    <DashboardPageShell as="main" className="scanner-v2">
      {header}

      {/* Mode bar */}
      <div className="scanner-v2-modes" role="group" aria-label="Scanner mode">
        {SCANNER_MODES.map((entry) => {
          const blocked = modeAvailability.get(entry.id);
          const selected = entry.id === mode;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={selected}
              title={blocked || entry.description}
              onClick={() => chooseMode(entry.id)}
              className={`${selected ? "is-active" : ""} ${blocked ? "is-blocked" : ""}`}
            >
              <span className="scanner-v2-dot" style={{ background: entry.dot }} aria-hidden />
              {entry.label}
            </button>
          );
        })}
      </div>

      <div className="scanner-v2-grid">
        {/* ---------------- main card ---------------- */}
        <section className="scanner-v2-card scanner-v2-main">
          <div className="scanner-v2-source-row">
            <div className="scanner-v2-segment" role="tablist" aria-label="Scan with">
              {(
                [
                  ["camera", "This camera"],
                  ["phone", "Phone"],
                  ["usb", "USB scanner"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={source === id}
                  onClick={() => chooseSource(id)}
                  className={source === id ? "is-active" : ""}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className={`scanner-v2-pill is-${statusPill.tone}`}>
              <span aria-hidden />
              {statusPill.label}
            </span>
          </div>

          <div className="scanner-v2-banner">
            <strong>{activeMode.label} mode</strong>
            <span>{activeMode.description}</span>
          </div>

          {actionError && (
            <DashboardNotice tone="danger" className="scanner-v2-error">
              {actionError}
            </DashboardNotice>
          )}

          {/* This camera */}
          {source === "camera" && (
            <div className={`scanner-v2-viewfinder ${flash ? "is-flash" : ""}`}>
              {armed ? (
                <>
                  <BarcodeScannerView
                    active={scanning}
                    continuous
                    deviceId={deviceId}
                    onDecode={(text) => handleScan(text, "camera")}
                    onStatusChange={setCameraStatus}
                    onStream={handleStream}
                    readyStatus="Point the camera at a QR code or barcode."
                    className="scanner-v2-video-wrap"
                    videoClassName="scanner-v2-video"
                  />
                  <span className="scanner-v2-frame" aria-hidden>
                    <i />
                    <i />
                    <i />
                    <i />
                    <b />
                  </span>
                  <div className="scanner-v2-chips">
                    <span className="scanner-v2-chip is-live">
                      <span aria-hidden />
                      {scanning ? "LIVE" : "PAUSED"}
                    </span>
                    {cameraName && <span className="scanner-v2-chip">{cameraName}</span>}
                  </div>
                  <div className="scanner-v2-tools">
                    <button
                      type="button"
                      onClick={switchCamera}
                      disabled={cameras.length < 2}
                      aria-label="Switch camera"
                      title={cameras.length < 2 ? "Only one camera found" : "Switch camera"}
                    >
                      <UiIcon name="camera-switch" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleTorch()}
                      disabled={!torchTrack}
                      aria-pressed={torchOn}
                      aria-label="Torch"
                      title={torchTrack ? "Torch" : "This camera has no torch"}
                    >
                      <UiIcon name="flash" className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="scanner-v2-hint" role="status" aria-live="polite">
                    {cameraStatus.error
                      ? cameraStatus.error
                      : !scanning
                        ? "Paused. Finish the action on the right, or scan again."
                        : "Hold the code inside the frame. QR, EAN-13, UPC and Code 128 supported."}
                  </p>
                  {!scanning && (
                    <button type="button" onClick={rearm} className="scanner-v2-resume">
                      Scan again
                    </button>
                  )}
                </>
              ) : (
                <div className="scanner-v2-start">
                  <span className="scanner-v2-start-icon">
                    <UiIcon name="scan" className="h-6 w-6" />
                  </span>
                  <p className="scanner-v2-start-title">Ready to scan</p>
                  <p className="scanner-v2-start-body">Your browser will ask for camera access the first time.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setArmed(true);
                      setScanning(true);
                    }}
                    className={buttonClassName()}
                  >
                    <UiIcon name="scan" className="h-4 w-4" />
                    Start camera
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Phone */}
          {source === "phone" &&
            (phoneLinked ? (
              <div className="scanner-v2-phone-live">
                <div className="scanner-v2-phone-art" aria-hidden>
                  <span className="scanner-v2-phone-notch" />
                  <span className="scanner-v2-frame is-small">
                    <i />
                    <i />
                    <i />
                    <i />
                    <b />
                  </span>
                  <span className="scanner-v2-phone-btn">{phoneOnline ? "Scanning…" : "Waiting…"}</span>
                </div>
                <div className="scanner-v2-phone-text">
                  <span className={`scanner-v2-pill is-${phoneOnline ? "success" : "warning"} on-dark`}>
                    <span aria-hidden />
                    {phoneOnline ? "Phone connected" : "Phone disconnected"}
                  </span>
                  <h3>{pairing?.device_label || "Phone"}</h3>
                  <p>
                    Scan with the phone. Results land here on the laptop with a beep. The phone also beeps (and
                    vibrates on Android) on each scan.
                  </p>
                  <dl>
                    <div>
                      <dt>Signal</dt>
                      <dd>{phoneOnline ? "Strong" : "Lost"}</dd>
                    </div>
                    <div>
                      <dt>Scans</dt>
                      <dd>{phoneScanCount}</dd>
                    </div>
                    <div>
                      <dt>Linked</dt>
                      <dd>{pairing?.linked_at ? formatAgo(new Date(pairing.linked_at).getTime(), now) : "—"}</dd>
                    </div>
                  </dl>
                  <div className="scanner-v2-phone-actions">
                    <button type="button" onClick={() => void disconnect()} className="scanner-v2-dark-outline">
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="scanner-v2-pair">
                <div className="scanner-v2-pair-qr">
                  {pairingLoading ? (
                    <span className="scanner-v2-spinner" aria-label="Preparing code" />
                  ) : pairUrl && pairSecondsLeft > 0 ? (
                    <QRCode value={pairUrl} size={168} level="M" />
                  ) : (
                    <button type="button" onClick={() => void startPairing()} className={buttonClassName()}>
                      New code
                    </button>
                  )}
                </div>
                <div className="scanner-v2-pair-text">
                  <h3>Pair your phone in 2 seconds</h3>
                  <ol>
                    <li>Open the phone camera and point it at this code</li>
                    <li>Tap the SydIN link. No app, no login on the phone.</li>
                    <li>Scans appear here instantly, with sound.</li>
                  </ol>
                  {pairing?.pairing_code && pairSecondsLeft > 0 && (
                    <p className="scanner-v2-pair-code">
                      Or enter code at <span className="is-mono">sydin.site/pair</span>
                      <strong>
                        {pairing.pairing_code.slice(0, 3)} {pairing.pairing_code.slice(3)}
                      </strong>
                    </p>
                  )}
                  <div className="scanner-v2-pair-foot">
                    <span>
                      {pairSecondsLeft > 0
                        ? `Expires in ${Math.floor(pairSecondsLeft / 60)}:${String(pairSecondsLeft % 60).padStart(2, "0")}`
                        : "Code expired"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void startPairing()}
                      disabled={pairingLoading}
                      className={buttonClassName({ variant: "secondary" })}
                    >
                      New code
                    </button>
                  </div>
                </div>
              </div>
            ))}

          {/* USB scanner */}
          {source === "usb" && (
            <div className="scanner-v2-usb">
              <span className="scanner-v2-start-icon">
                <UiIcon name="scan" className="h-6 w-6" />
              </span>
              <p className="scanner-v2-start-title">Ready for your USB or Bluetooth scanner</p>
              <p className="scanner-v2-start-body">
                Just scan. No field needs to be selected: SydIN listens on this page and picks up each code
                when the scanner sends Enter.
              </p>
            </div>
          )}

          {/* Manual input: same path as every scan */}
          <form
            className="scanner-v2-manual"
            onSubmit={(event) => {
              event.preventDefault();
              const value = manualInput.trim();
              if (!value) return;
              handleScan(value, "manual");
              setManualInput("");
            }}
          >
            <label className="scanner-v2-manual-field">
              <UiIcon name="search" className="h-4 w-4" />
              <input
                value={manualInput}
                onChange={(event) => setManualInput(event.target.value)}
                placeholder="Type or paste a code, SKU or SydIN link…"
                aria-label="Type or paste a code"
              />
              <kbd>Enter</kbd>
            </label>
            <button type="submit" className={buttonClassName()} disabled={!manualInput.trim()}>
              Look up
            </button>
          </form>

          <div className="scanner-v2-toggles">
            {(
              [
                ["vibrate", "Vibrate phone", "On each scan"],
                ["autoOpen", "Auto-open SydIN links", "Lookup mode only"],
                ["continuous", "Continuous scan", "Keep camera on"],
                ["allowRepeats", "Allow repeats", "Same code twice in a row"],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="scanner-v2-toggle">
                <input
                  type="checkbox"
                  role="switch"
                  checked={settings[key]}
                  onChange={(event) => updateSetting(key, event.target.checked)}
                />
                <span className="scanner-v2-switch" aria-hidden />
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* ---------------- side column ---------------- */}
        <div className="scanner-v2-side">
          <section className="scanner-v2-card scanner-v2-last">
            <div className="scanner-v2-card-head">
              <h2>Last scan</h2>
              {last && <span>{formatAgo(last.at, now)}</span>}
            </div>

            {!resolution && (
              <p className="scanner-v2-empty">Scan a code with any of the three ways on the left. The result appears here.</p>
            )}

            {resolution?.kind === "none" && (
              <div className="scanner-v2-unknown">
                <span className="scanner-v2-unknown-icon" aria-hidden>
                  !
                </span>
                <p className="scanner-v2-item-name">Unknown code</p>
                <p className="scanner-v2-raw">{last?.raw}</p>
                <p className="scanner-v2-muted">Nothing in SydIN has this code.</p>
                <div className="scanner-v2-actions">
                  <Link
                    href={`/dashboard/add-item?barcode=${encodeURIComponent(last?.raw || "")}&returnTo=${encodeURIComponent("/dashboard/scanner")}`}
                    className={buttonClassName()}
                  >
                    Create item with this barcode
                  </Link>
                  <button type="button" onClick={clearResult} className={buttonClassName({ variant: "secondary" })}>
                    Scan again
                  </button>
                </div>
              </div>
            )}

            {resolution?.kind === "external" && (
              <div className="scanner-v2-unknown">
                <p className="scanner-v2-item-name">Link outside SydIN</p>
                <p className="scanner-v2-raw">{resolution.url}</p>
                <p className="scanner-v2-muted">SydIN never opens outside links by itself.</p>
                <div className="scanner-v2-actions">
                  <a href={resolution.url} target="_blank" rel="noopener noreferrer" className={buttonClassName({ variant: "secondary" })}>
                    Open link
                  </a>
                </div>
              </div>
            )}

            {resolution?.kind === "ambiguous" && (
              <div className="scanner-v2-pick">
                <p className="scanner-v2-muted">{resolution.items.length} items share that code. Pick one:</p>
                {resolution.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      last &&
                      setLast({ ...last, resolution: { kind: "item", item, matchedBy: "sku" } })
                    }
                  >
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.item_code || item.sku || "No identifier"}</small>
                    </span>
                    <UiIcon name="chevron-right" className="h-4 w-4" />
                  </button>
                ))}
              </div>
            )}

            {scannedItem && resolution?.kind === "item" && (
              <div className="scanner-v2-found">
                <div className="scanner-v2-item-head">
                  <span className="scanner-v2-thumb">
                    <ProductThumbnail
                      src={scannedItem.image}
                      alt=""
                      sizes="56px"
                      imgClassName="object-cover"
                      iconClassName="h-6 w-6"
                      fallbackClassName="flex h-full w-full items-center justify-center"
                    />
                  </span>
                  <span className="scanner-v2-item-text">
                    <span className="scanner-v2-item-name">{scannedItem.name}</span>
                    <span className="scanner-v2-item-meta">
                      <span className="is-mono">{scannedItem.item_code || scannedItem.sku || "No code"}</span>
                      <span aria-hidden>·</span>
                      {depotName(scannedItem)}
                    </span>
                  </span>
                  {scannedItem.quantity <= 0 ? (
                    <StatusBadge tone="danger">Out of stock</StatusBadge>
                  ) : scannedItem.quantity <= minFor(scannedItem) ? (
                    <StatusBadge tone="warning">Low stock</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">In stock</StatusBadge>
                  )}
                </div>

                <dl className="scanner-v2-figures">
                  <div>
                    <dt>On hand</dt>
                    <dd>{describeItemQuantity(scannedItem)}</dd>
                  </div>
                  <div>
                    <dt>Min</dt>
                    <dd>{minFor(scannedItem)}</dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>{priceLabel(scannedItem)}</dd>
                  </div>
                </dl>

                <p className="scanner-v2-muted">
                  Matched by <strong>{describeMatch(resolution.matchedBy)}</strong>
                  {last && last.source !== "manual" ? ` · from the ${SOURCE_LABEL[last.source]}` : ""}
                </p>

                {mode === "lookup" && (
                  <div className="scanner-v2-actions is-split">
                    <Link
                      href={`/dashboard/inventory/${scannedItem.id}?returnTo=${encodeURIComponent("/dashboard/scanner")}`}
                      className={buttonClassName()}
                    >
                      Open item
                    </Link>
                    <Link
                      href={`/dashboard/inventory/${scannedItem.id}?action=stock&returnTo=${encodeURIComponent("/dashboard/scanner")}`}
                      className={buttonClassName({ variant: "secondary" })}
                    >
                      Record movement
                    </Link>
                  </div>
                )}

                {(mode === "receive" || mode === "issue") && (
                  <form
                    className="scanner-v2-action"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!busy) void applyStockMovement(scannedItem, mode === "receive" ? "stock_in" : "stock_out");
                    }}
                  >
                    <label>
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
                        className="ui-input"
                      />
                    </label>
                    <div className="scanner-v2-actions is-split">
                      {cancelButton}
                      <button type="submit" disabled={busy} className={buttonClassName()}>
                        {busy ? "Saving…" : mode === "receive" ? "Add stock" : "Remove stock"}
                      </button>
                    </div>
                  </form>
                )}

                {mode === "count" && (
                  <div className="scanner-v2-actions is-split">
                    {cancelButton}
                    <button type="button" onClick={() => applyCountScan(scannedItem)} className={buttonClassName()}>
                      Count 1
                    </button>
                  </div>
                )}

                {mode === "transfer" && (
                  <div className="scanner-v2-action">
                    <label>
                      Destination depot
                      <select
                        value={selectedDepot || ""}
                        onChange={(e) => setSelectedDepot(e.target.value ? Number(e.target.value) : null)}
                        disabled={busy}
                        className="ui-input"
                      >
                        <option value="">Choose a depot…</option>
                        {depots.map((depot) => (
                          <option key={depot.id} value={depot.id}>
                            {depot.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="scanner-v2-actions is-split">
                      {cancelButton}
                      <button
                        type="button"
                        disabled={busy || !selectedDepot}
                        onClick={() => void applyTransfer(scannedItem)}
                        className={buttonClassName()}
                      >
                        {busy ? "Moving…" : "Move to depot"}
                      </button>
                    </div>
                  </div>
                )}

                {mode === "assign" && scannedAssets.length > 0 && (
                  <div className="scanner-v2-action">
                    <label>
                      Unit to assign
                      <select
                        value={selectedAssetId || ""}
                        onChange={(e) => setSelectedAssetId(Number(e.target.value))}
                        disabled={busy}
                        className="ui-input"
                      >
                        {scannedAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.public_id} {asset.assigned_to_name ? `(${asset.assigned_to_name})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assign to
                      <input
                        type="text"
                        list="assignee-suggestions"
                        value={assigneeInput}
                        onChange={(e) => void updateAssigneeSuggestions(e.target.value)}
                        placeholder="Name or email…"
                        disabled={busy}
                        className="ui-input"
                      />
                      {assigneeSuggestions.length > 0 && (
                        <datalist id="assignee-suggestions">
                          {assigneeSuggestions.map((suggestion) => (
                            <option key={suggestion.name} value={suggestion.name} />
                          ))}
                        </datalist>
                      )}
                    </label>
                    <div className="scanner-v2-actions is-split">
                      {cancelButton}
                      <button
                        type="button"
                        disabled={busy || !assigneeInput}
                        onClick={() => selectedAssetId && void applyAssetEvent(selectedAssetId, "assigned")}
                        className={buttonClassName()}
                      >
                        {busy ? "Assigning…" : "Assign unit"}
                      </button>
                    </div>
                  </div>
                )}

                {(mode === "repair" || mode === "return") && scannedAssets.length > 0 && (
                  <div className="scanner-v2-action">
                    <label>
                      {mode === "repair" ? "Unit to send for repair" : "Unit to return"}
                      <select
                        value={selectedAssetId || ""}
                        onChange={(e) => setSelectedAssetId(Number(e.target.value))}
                        disabled={busy}
                        className="ui-input"
                      >
                        {scannedAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.public_id}{" "}
                            {mode === "repair"
                              ? `(Current: ${asset.condition || "unknown"})`
                              : `(Status: ${asset.status})`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="scanner-v2-actions is-split">
                      {cancelButton}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => selectedAssetId && void applyAssetEvent(selectedAssetId, "status_changed")}
                        className={buttonClassName()}
                      >
                        {busy
                          ? mode === "repair"
                            ? "Marking…"
                            : "Returning…"
                          : mode === "repair"
                            ? "Mark for repair"
                            : "Return to stock"}
                      </button>
                    </div>
                  </div>
                )}

                {(mode === "assign" || mode === "repair" || mode === "return") && scannedAssets.length === 0 && (
                  <p className="scanner-v2-muted">
                    This item has no tracked units yet. Add units on the item page first.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="scanner-v2-card scanner-v2-session">
            <div className="scanner-v2-card-head">
              <div>
                <h2>This session</h2>
                <span>
                  {session.length} {session.length === 1 ? "scan" : "scans"} · {sessionItemCount}{" "}
                  {sessionItemCount === 1 ? "item" : "items"}
                </span>
              </div>
              {session.length > 0 && (
                <div className="scanner-v2-session-actions">
                  <button type="button" onClick={exportCsv} className={buttonClassName({ variant: "secondary" })}>
                    Export CSV
                  </button>
                  <button type="button" onClick={() => setSession([])} className="scanner-v2-text-button">
                    Clear
                  </button>
                </div>
              )}
            </div>

            {session.length === 0 ? (
              <p className="scanner-v2-empty">Every scan in this visit is listed here.</p>
            ) : (
              <ul className="scanner-v2-list">
                {session.map((entry) => (
                  <li key={entry.id}>
                    <span className={`scanner-v2-list-icon ${entry.ok ? "is-ok" : "is-bad"}`} aria-hidden>
                      {entry.ok ? <UiIcon name="check" className="h-3.5 w-3.5" /> : "!"}
                    </span>
                    <span className="scanner-v2-list-text">
                      <strong>{entry.title}</strong>
                      <small>
                        <span className="is-mono">{entry.code}</span> · {entry.how} · {entry.mode}
                      </small>
                    </span>
                    <time className="is-mono">{formatTime(entry.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <DialogShell
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Scan history"
        description={`The last ${HISTORY_LIMIT} scans made on this computer.`}
        footer={
          <div className="flex justify-end gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  writeJson(HISTORY_KEY, []);
                  setHistory([]);
                }}
                className={buttonClassName({ variant: "secondary" })}
              >
                Clear history
              </button>
            )}
            <button type="button" onClick={() => setHistoryOpen(false)} className={buttonClassName()}>
              Done
            </button>
          </div>
        }
      >
        {history.length === 0 ? (
          <p className="scanner-v2-empty">No scans on this computer yet.</p>
        ) : (
          <ul className="scanner-v2-list is-history">
            {history.map((entry) => (
              <li key={entry.id}>
                <span className={`scanner-v2-list-icon ${entry.ok ? "is-ok" : "is-bad"}`} aria-hidden>
                  {entry.ok ? <UiIcon name="check" className="h-3.5 w-3.5" /> : "!"}
                </span>
                <span className="scanner-v2-list-text">
                  <strong>{entry.title}</strong>
                  <small>
                    <span className="is-mono">{entry.code}</span> · {entry.how} · {entry.mode}
                  </small>
                </span>
                <time className="is-mono">
                  {new Date(entry.at).toLocaleDateString([], { day: "numeric", month: "short" })} {formatTime(entry.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </DialogShell>
    </DashboardPageShell>
  );
}

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <DashboardPageShell as="main">
          <LoadingSkeletonGroup count={3} itemClassName="min-h-32" />
        </DashboardPageShell>
      }
    >
      <ScannerWorkspace />
    </Suspense>
  );
}
