"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import ProductThumbnail from "@/components/inventory/ProductThumbnail";
import ScannerModal from "@/components/scanner/ScannerModal";
import { useKeyboardWedge } from "@/components/scanner/useKeyboardWedge";
import { buttonClassName, UnsavedChangesGuard, useToast } from "@/components/ui";
import Select from "@/components/ui/Select";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import { DashboardNotice, DashboardPageShell, LoadingSkeletonGroup } from "@/components/dashboard/Workspace";
import { useBusinessPeople } from "@/components/dashboard/DoneBy";
import { getBusinessUser } from "@/app/lib/business";
import { supabase } from "@/app/lib/supabase";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { formatDepotLabel, getActiveDepotsForUser, type Depot } from "@/app/lib/depots";
import { createSupplier, getSupplierErrorMessage, getSuppliersForUser, type Supplier } from "@/app/lib/suppliers";
import {
  getEffectiveItemLowStockThreshold,
  getInventoryUnitLabel,
  normalizeCurrencyCode,
} from "@/app/lib/inventoryItemModel";
import { convertAmount, currencyChoicesIncluding, formatExactPrice, getCurrencyContext, getExchangeRate } from "@/app/lib/currency";
import { getLastDepotId, getLastPaymentMethod, rememberDepotId, rememberPaymentMethod } from "@/app/lib/lastUsed";
import { paymentMethodLabel, paymentMethodOptions } from "@/app/lib/paymentMethods";
import { exportPurchaseOrderPdf } from "@/app/lib/purchaseOrderPdfExport";
import { brandingFromSettings } from "@/app/lib/documentPdf";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";
import {
  PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS,
  PURCHASE_ORDER_PAYMENT_TERMS_LABELS,
  createPurchaseOrder,
  getNextPoNumber,
  getPurchaseOrdersForUser,
  isPurchaseOrdersSchemaMissing,
  logPurchaseOrderActivity,
  markPurchaseOrderOrdered,
  receivePurchaseOrder,
  updateDraftPurchaseOrder,
  uploadPurchaseOrderAttachment,
  type PurchaseOrder,
  type PurchaseOrderExpenseCategory,
  type PurchaseOrderLineInput,
  type PurchaseOrderPaymentTerms,
} from "@/app/lib/purchaseOrders";

/*
 * New purchase order (redesign 9 Oct 2026, Sayed's PO spec): three numbered
 * sections -- Supplier, Items, Delivery & payment -- a live summary on the
 * right and a sticky bar with Save draft / Place order. Items are added from
 * one search box that also takes a USB scanner or the camera; quick fills
 * bring in every stock alert or the supplier's last order. The work in
 * progress is kept on this computer (not in the database) until it is saved,
 * so an abandoned form never leaves a stray draft or uses up a PO number.
 * ?from=<id> duplicates an order, ?edit=<id> continues a draft, ?items=1,2
 * (&qty=20,4) starts with those items.
 */

interface PickerItem {
  id: number;
  name: string;
  image: string | null;
  quantity: number;
  sku: string | null;
  item_code: string | null;
  barcode?: string | null;
  unit_type: string | null;
  custom_unit_label: string | null;
  cost_price: number | string | null;
  min_stock_level: number | null;
}

interface LineDraft {
  key: string;
  lineType: "inventory" | "expense";
  inventoryItemId: number | null;
  image: string | null;
  name: string;
  sku: string | null;
  itemCode: string | null;
  unitLabel: string | null;
  quantity: string;
  unitCost: string;
  affectsStock: boolean;
  expenseCategory: PurchaseOrderExpenseCategory;
  note: string;
  /** "Out of stock · alert 30", "80 on hand · alert 81". */
  context: string;
  /** "last paid $2.00" / "item cost $2.50". */
  costHint: string;
}

const ITEM_SELECT = "id, name, image, quantity, sku, item_code, barcode, unit_type, custom_unit_label, cost_price, min_stock_level";
const AUTOSAVE_KEY = "sydin:po-new-autosave";
const TERMS: PurchaseOrderPaymentTerms[] = ["on_delivery", "paid_now", "net_7", "net_30"];

function makeKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function roundForCurrency(value: number, currencyCode: string) {
  const digits = ["LBP", "JPY", "KRW", "IQD", "SYP"].includes(currencyCode.toUpperCase()) ? 0 : 2;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function num(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function NewPurchaseOrder() {
  const router = useRouter();
  const { showToast } = useToast();
  const people = useBusinessPeople();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const attachmentRef = useRef<HTMLInputElement | null>(null);
  const restoredRef = useRef(false);

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [subscription, setSubscription] = useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [alertItems, setAlertItems] = useState<Array<PickerItem & { level: number }>>([]);
  const [loadError, setLoadError] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [poNumberEdited, setPoNumberEdited] = useState(false);
  const [editingNumber, setEditingNumber] = useState(false);

  const [supplierMode, setSupplierMode] = useState<"saved" | "oneoff">("saved");
  const [supplierId, setSupplierId] = useState("");
  const [oneOffName, setOneOffName] = useState("");
  const [oneOffContact, setOneOffContact] = useState("");
  const [supplierPicking, setSupplierPicking] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", contact_name: "", phone: "" });
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  const [lines, setLines] = useState<LineDraft[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [depotId, setDepotId] = useState("");
  const [expected, setExpected] = useState("");
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState<PurchaseOrderPaymentTerms>("on_delivery");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidMethod, setPaidMethod] = useState("cash");
  const [paidBy, setPaidBy] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("");
  const [delivery, setDelivery] = useState("");
  const [orderCurrency, setOrderCurrency] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [receiveNow, setReceiveNow] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);

  const currencyCode = normalizeCurrencyCode(orderCurrency ?? settings.currency_code, "USD");
  const baseCurrency = getCurrencyContext().base;
  const exchangeRate = getExchangeRate(baseCurrency, currencyCode);
  const costIn = useCallback(
    (cost: number | string | null | undefined) =>
      cost === null || cost === undefined || cost === ""
        ? ""
        : String(roundForCurrency(convertAmount(Number(cost), baseCurrency, currencyCode), currencyCode)),
    [baseCurrency, currencyCode]
  );
  const money = useCallback((value: number) => formatExactPrice(value, currencyCode) || "—", [currencyCode]);

  const capabilities = getSubscriptionCapabilities(subscription);
  const fallbackLevel = getEffectiveLowStockThreshold(subscription, settings.low_stock_threshold);
  const levelFor = useCallback(
    (item: Pick<PickerItem, "min_stock_level">) =>
      capabilities.customLowStockThreshold ? getEffectiveItemLowStockThreshold(item.min_stock_level, fallbackLevel) : fallbackLevel,
    [capabilities.customLowStockThreshold, fallbackLevel]
  );

  const selectedSupplier = supplierMode === "saved" ? suppliers.find((entry) => String(entry.id) === supplierId) || null : null;
  const selectedDepot = depots.find((entry) => String(entry.id) === depotId) || null;
  const supplierOrders = useMemo(
    () =>
      orders
        .filter((order) => order.status !== "cancelled" && order.id !== editingId)
        .filter((order) =>
          selectedSupplier
            ? order.supplier_id === selectedSupplier.id
            : supplierMode === "oneoff" && oneOffName.trim()
              ? order.supplier_name_snapshot === oneOffName.trim()
              : false
        )
        .sort((a, b) => (b.purchase_date || b.created_at).localeCompare(a.purchase_date || a.created_at)),
    [editingId, oneOffName, orders, selectedSupplier, supplierMode]
  );
  const lastOrder = supplierOrders[0] || null;

  /** What this supplier was last paid for an item, in this order's currency. */
  const lastPaid = useCallback(
    (itemId: number) => {
      for (const order of supplierOrders) {
        if (normalizeCurrencyCode(order.currency_code, baseCurrency) !== currencyCode) continue;
        const line = order.lines.find((entry) => entry.inventory_item_id === itemId && entry.unit_cost !== null && Number(entry.unit_cost) > 0);
        if (line) return Number(line.unit_cost);
      }
      return null;
    },
    [baseCurrency, currencyCode, supplierOrders]
  );

  const contextFor = useCallback(
    (item: PickerItem) => {
      const level = levelFor(item);
      const unit = getInventoryUnitLabel(item.unit_type, item.custom_unit_label);
      if (Number(item.quantity) <= 0) return `Out of stock · alert ${level}`;
      return `${item.quantity} ${/^pieces?$/i.test(unit) ? "on hand" : `${unit.toLowerCase()} on hand`} · alert ${level}`;
    },
    [levelFor]
  );

  const lineFromItem = useCallback(
    (item: PickerItem, quantity = 1): LineDraft => {
      const paidBefore = lastPaid(item.id);
      const itemCost = costIn(item.cost_price);
      return {
        key: makeKey(),
        lineType: "inventory",
        inventoryItemId: item.id,
        image: item.image,
        name: item.name,
        sku: item.sku,
        itemCode: item.item_code,
        unitLabel: getInventoryUnitLabel(item.unit_type, item.custom_unit_label),
        quantity: String(quantity),
        unitCost: paidBefore !== null ? String(paidBefore) : itemCost,
        affectsStock: true,
        expenseCategory: "other",
        note: "",
        context: contextFor(item),
        costHint:
          paidBefore !== null
            ? `last paid ${money(paidBefore)}`
            : itemCost
              ? `item cost ${money(Number(itemCost))}`
              : "no cost on the item yet",
      };
    },
    [contextFor, costIn, lastPaid, money]
  );

  /* ---------------- load ---------------- */

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await getBusinessUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const [loadedSettings, loadedSubscription, loadedDepots, loadedSuppliers, loadedOrders, inventory] = await Promise.all([
        getOrCreateBusinessSettings(user.id),
        getUserSubscription(user.id),
        getActiveDepotsForUser(user.id).catch(() => [] as Depot[]),
        getSuppliersForUser(user.id).catch(() => [] as Supplier[]),
        getPurchaseOrdersForUser(user.id).catch(() => [] as PurchaseOrder[]),
        supabase.from("inventory").select(`${ITEM_SELECT}, alert_snoozed_until`).eq("user_id", user.id),
      ]);
      if (!active) return;
      setUserId(user.id);
      setSettings(loadedSettings);
      setSubscription(loadedSubscription);
      setDepots(loadedDepots);
      setSuppliers(loadedSuppliers);
      setOrders(loadedOrders);

      const caps = getSubscriptionCapabilities(loadedSubscription);
      const fallback = getEffectiveLowStockThreshold(loadedSubscription, loadedSettings.low_stock_threshold);
      const now = Date.now();
      const rows = (inventory.data || []) as Array<PickerItem & { alert_snoozed_until: string | null }>;
      setAlertItems(
        rows
          .filter((row) => !row.alert_snoozed_until || new Date(row.alert_snoozed_until).getTime() <= now)
          .map((row) => ({ ...row, level: caps.customLowStockThreshold ? getEffectiveItemLowStockThreshold(row.min_stock_level, fallback) : fallback }))
          .filter((row) => Number(row.quantity) <= row.level)
      );

      const params = new URLSearchParams(window.location.search);
      const sourceId = Number(params.get("edit") || params.get("from"));
      const isEdit = params.has("edit");
      const source = Number.isFinite(sourceId) && sourceId > 0 ? loadedOrders.find((order) => order.id === sourceId) : null;
      const defaultDepot = loadedDepots.find((depot) => depot.is_default)?.id;
      const lastDepot = getLastDepotId();
      setDepotId(
        source?.depot_id
          ? String(source.depot_id)
          : lastDepot && loadedDepots.some((depot) => String(depot.id) === lastDepot)
            ? lastDepot
            : defaultDepot
              ? String(defaultDepot)
              : ""
      );
      setPaidMethod(getLastPaymentMethod() || loadedSettings.payment_methods?.[0] || "cash");

      if (source && (!isEdit || source.status === "draft")) {
        if (isEdit) {
          setEditingId(source.id);
          setPoNumber(source.po_number);
          setPoNumberEdited(true);
        }
        if (source.supplier_id && loadedSuppliers.some((entry) => entry.id === source.supplier_id)) {
          setSupplierMode("saved");
          setSupplierId(String(source.supplier_id));
        } else if (source.supplier_name_snapshot) {
          setSupplierMode("oneoff");
          setOneOffName(source.supplier_name_snapshot);
          setOneOffContact(source.supplier_contact_snapshot || "");
        }
        setTitle(source.title || "");
        setNotes(source.notes || "");
        setExpected(isEdit ? source.expected_delivery_date || "" : "");
        if (source.payment_terms) setTerms(source.payment_terms);
        if (isEdit) {
          setDiscount(source.discount ? String(source.discount) : "");
          setDelivery(source.delivery_fee ? String(source.delivery_fee) : "");
        }
        if (source.currency_code) setOrderCurrency(normalizeCurrencyCode(source.currency_code, "USD"));
        const itemIds = source.lines.map((line) => line.inventory_item_id).filter((id): id is number => id !== null);
        const byId = new Map(rows.filter((row) => itemIds.includes(row.id)).map((row) => [row.id, row]));
        setLines(
          source.lines.map((line) => {
            const item = line.inventory_item_id ? byId.get(line.inventory_item_id) : undefined;
            return {
              key: makeKey(),
              lineType: line.line_type,
              inventoryItemId: line.inventory_item_id,
              image: item?.image ?? null,
              name: line.name_snapshot,
              sku: line.sku_snapshot,
              itemCode: line.item_code_snapshot,
              unitLabel: line.unit_label_snapshot,
              quantity: String(line.quantity),
              unitCost: line.unit_cost === null ? "" : String(line.unit_cost),
              affectsStock: line.affects_stock,
              expenseCategory: line.expense_category || "other",
              note: line.notes || "",
              context: item ? `${Number(item.quantity) <= 0 ? "Out of stock" : `${item.quantity} on hand`} · alert ${caps.customLowStockThreshold ? getEffectiveItemLowStockThreshold(item.min_stock_level, fallback) : fallback}` : "",
              costHint: "",
            };
          })
        );
        restoredRef.current = true;
      } else {
        const ids = (params.get("items") || "").split(",").map((value) => Number(value.trim())).filter((value) => value > 0);
        const qtys = (params.get("qty") || "").split(",").map((value) => Number(value.trim()));
        if (ids.length) {
          const byId = new Map(rows.map((row) => [row.id, row]));
          setLines(
            ids
              .map((id, index) => {
                const item = byId.get(id);
                if (!item) return null;
                const level = caps.customLowStockThreshold ? getEffectiveItemLowStockThreshold(item.min_stock_level, fallback) : fallback;
                const qty = qtys[index] > 0 ? qtys[index] : Math.max(level * 2 - Number(item.quantity), 1);
                return {
                  key: makeKey(),
                  lineType: "inventory" as const,
                  inventoryItemId: item.id,
                  image: item.image,
                  name: item.name,
                  sku: item.sku,
                  itemCode: item.item_code,
                  unitLabel: getInventoryUnitLabel(item.unit_type, item.custom_unit_label),
                  quantity: String(qty),
                  unitCost:
                    item.cost_price === null || item.cost_price === ""
                      ? ""
                      : String(roundForCurrency(convertAmount(Number(item.cost_price), getCurrencyContext().base, normalizeCurrencyCode(loadedSettings.currency_code, "USD")), normalizeCurrencyCode(loadedSettings.currency_code, "USD"))),
                  affectsStock: true,
                  expenseCategory: "other" as const,
                  note: "",
                  context: `${Number(item.quantity) <= 0 ? "Out of stock" : `${item.quantity} on hand`} · alert ${level}`,
                  costHint: item.cost_price ? "item cost" : "",
                };
              })
              .filter((line): line is NonNullable<typeof line> => line !== null)
          );
          restoredRef.current = true;
        }
      }

      // Nothing asked for in the link: bring back the work in progress.
      if (!restoredRef.current) {
        try {
          const saved = JSON.parse(window.localStorage.getItem(AUTOSAVE_KEY) || "null");
          if (saved && saved.userId === user.id && Array.isArray(saved.lines) && saved.lines.length) {
            setLines(saved.lines);
            setSupplierMode(saved.supplierMode || "saved");
            setSupplierId(saved.supplierId || "");
            setOneOffName(saved.oneOffName || "");
            setOneOffContact(saved.oneOffContact || "");
            setTitle(saved.title || "");
            setNotes(saved.notes || "");
            setExpected(saved.expected || "");
            setTerms(saved.terms || "on_delivery");
            setDiscount(saved.discount || "");
            setDelivery(saved.delivery || "");
            if (saved.depotId) setDepotId(saved.depotId);
            setAutosavedAt(saved.at || Date.now());
          }
        } catch {
          // Nothing to restore.
        }
        restoredRef.current = true;
      }
      setLoading(false);
    })().catch((error: unknown) => {
      if (!active) return;
      setLoadError(isPurchaseOrdersSchemaMissing(error) ? "Purchase orders are not set up in this database yet." : "This page could not be loaded. Refresh and try again.");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  // The next number follows the depot (or business) prefix.
  useEffect(() => {
    if (!userId || poNumberEdited) return;
    let active = true;
    getNextPoNumber(userId, {
      depotCode: selectedDepot?.code,
      depotName: selectedDepot?.name,
      businessName: settings.business_name,
      poPrefix: settings.po_prefix,
    })
      .then((next) => {
        if (active) setPoNumber(next);
      })
      .catch(() => {
        if (active) setPoNumber("SYDIN-PO-0001");
      });
    return () => {
      active = false;
    };
  }, [poNumberEdited, selectedDepot?.code, selectedDepot?.name, settings.business_name, settings.po_prefix, userId]);

  // Autosave on this computer, 800ms after the last change.
  useEffect(() => {
    if (loading || editingId || !userId || !restoredRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        if (lines.length === 0) {
          window.localStorage.removeItem(AUTOSAVE_KEY);
          setAutosavedAt(null);
          return;
        }
        const at = Date.now();
        window.localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({ userId, at, lines, supplierMode, supplierId, oneOffName, oneOffContact, title, notes, expected, terms, discount, delivery, depotId })
        );
        setAutosavedAt(at);
      } catch {
        // Storage full or blocked: the page still works.
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [delivery, depotId, discount, editingId, expected, lines, loading, notes, oneOffContact, oneOffName, supplierId, supplierMode, terms, title, userId]);

  /* ---------------- item search ---------------- */

  useEffect(() => {
    if (!userId || !searchOpen) return;
    const term = query.trim().replace(/[%,()]/g, " ").slice(0, 60);
    let active = true;
    const timer = window.setTimeout(async () => {
      let request = supabase.from("inventory").select(ITEM_SELECT).eq("user_id", userId).order("name", { ascending: true }).limit(8);
      if (term) request = request.or(`name.ilike.%${term}%,sku.ilike.%${term}%,item_code.ilike.%${term}%,barcode.ilike.%${term}%`);
      const { data } = await request;
      if (!active) return;
      setResults((data || []) as PickerItem[]);
      setHighlight(0);
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, searchOpen, userId]);

  // "/" jumps to the search box, as in the spec.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.ctrlKey || event.metaKey) return;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addItem = useCallback(
    (item: PickerItem, quantity?: number) => {
      setLines((current) => {
        const existing = current.find((line) => line.inventoryItemId === item.id);
        if (existing) {
          return current.map((line) =>
            line.key === existing.key ? { ...line, quantity: String((Number(line.quantity) || 0) + (quantity || 1)) } : line
          );
        }
        return [...current, lineFromItem(item, quantity || 1)];
      });
      setQuery("");
      setSearchOpen(false);
    },
    [lineFromItem]
  );

  /** A scanned or typed code: exact barcode, item code or SKU. */
  const addByCode = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || !userId) return;
      const safe = code.replace(/[%,()]/g, "");
      const publicId = code.match(/item\/([0-9a-f-]{36})/i)?.[1];
      const filter = publicId
        ? `public_id.eq.${publicId}`
        : `barcode.eq.${safe},item_code.ilike.${safe},sku.eq.${safe}`;
      const { data } = await supabase.from("inventory").select(ITEM_SELECT).eq("user_id", userId).or(filter).limit(2);
      const found = (data || []) as PickerItem[];
      if (found.length === 1) {
        addItem(found[0]);
        showToast({ tone: "success", message: `Added ${found[0].name}` });
      } else {
        showToast({ tone: "danger", message: found.length > 1 ? `${found.length} items share ${code}. Search by name.` : `No item with the code ${code}` });
      }
    },
    [addItem, showToast, userId]
  );

  useKeyboardWedge({ enabled: !loading && !scannerOpen, onCode: (code) => void addByCode(code) });

  const addFromAlerts = () => {
    const missing = alertItems.filter((item) => !lines.some((line) => line.inventoryItemId === item.id));
    if (missing.length === 0) {
      showToast({ tone: "info", message: "Every stock alert is already on this order." });
      return;
    }
    setLines((current) => [...current, ...missing.map((item) => lineFromItem(item, Math.max(item.level * 2 - Number(item.quantity), 1)))]);
    showToast({ tone: "success", message: `${missing.length} ${missing.length === 1 ? "item" : "items"} from stock alerts` });
  };

  const repeatLastOrder = async () => {
    if (!lastOrder) return;
    const ids = lastOrder.lines.map((line) => line.inventory_item_id).filter((id): id is number => id !== null);
    const { data } = ids.length ? await supabase.from("inventory").select(ITEM_SELECT).in("id", ids) : { data: [] };
    const byId = new Map(((data || []) as PickerItem[]).map((item) => [item.id, item]));
    const copied = lastOrder.lines
      .filter((line) => !line.inventory_item_id || !lines.some((existing) => existing.inventoryItemId === line.inventory_item_id))
      .map((line) => {
        const item = line.inventory_item_id ? byId.get(line.inventory_item_id) : undefined;
        if (item) {
          const draft = lineFromItem(item, line.quantity);
          return { ...draft, unitCost: line.unit_cost === null ? draft.unitCost : String(line.unit_cost), costHint: line.unit_cost ? `last paid ${money(Number(line.unit_cost))}` : draft.costHint };
        }
        return {
          key: makeKey(),
          lineType: line.line_type,
          inventoryItemId: null,
          image: null,
          name: line.name_snapshot,
          sku: line.sku_snapshot,
          itemCode: line.item_code_snapshot,
          unitLabel: line.unit_label_snapshot,
          quantity: String(line.quantity),
          unitCost: line.unit_cost === null ? "" : String(line.unit_cost),
          affectsStock: false,
          expenseCategory: line.expense_category || "other",
          note: line.notes || "",
          context: "",
          costHint: "",
        } as LineDraft;
      });
    setLines((current) => [...current, ...copied]);
    showToast({ tone: "success", message: `Copied ${copied.length} ${copied.length === 1 ? "line" : "lines"} from ${lastOrder.po_number}` });
  };

  const addGeneralLine = () =>
    setLines((current) => [
      ...current,
      {
        key: makeKey(),
        lineType: "expense",
        inventoryItemId: null,
        image: null,
        name: "",
        sku: null,
        itemCode: null,
        unitLabel: null,
        quantity: "1",
        unitCost: "",
        affectsStock: false,
        expenseCategory: "supplies",
        note: "",
        context: "",
        costHint: "",
      },
    ]);

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  /* ---------------- supplier ---------------- */

  const chooseSupplier = (id: string) => {
    setSupplierMode("saved");
    setSupplierId(id);
    setSupplierPicking(false);
    setNewSupplierOpen(false);
    // Their last order sets the terms and the depot.
    const previous = orders
      .filter((order) => String(order.supplier_id || "") === id && order.status !== "cancelled")
      .sort((a, b) => (b.purchase_date || b.created_at).localeCompare(a.purchase_date || a.created_at))[0];
    if (previous?.payment_terms) setTerms(previous.payment_terms);
    if (previous?.depot_id && depots.some((depot) => depot.id === previous.depot_id)) setDepotId(String(previous.depot_id));
  };

  const saveNewSupplier = async () => {
    if (!newSupplier.name.trim() || !userId) return;
    setCreatingSupplier(true);
    try {
      const created = await createSupplier(userId, { name: newSupplier.name, contact_name: newSupplier.contact_name, phone: newSupplier.phone });
      setSuppliers((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      chooseSupplier(String(created.id));
      setNewSupplier({ name: "", contact_name: "", phone: "" });
      showToast({ tone: "success", message: `${created.name} added to your suppliers` });
    } catch (error) {
      showToast({ tone: "danger", message: getSupplierErrorMessage(error) });
    } finally {
      setCreatingSupplier(false);
    }
  };

  const recentSuppliers = useMemo(() => {
    const seen = new Set<number>();
    const list: Supplier[] = [];
    for (const order of [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
      if (!order.supplier_id || seen.has(order.supplier_id)) continue;
      const supplier = suppliers.find((entry) => entry.id === order.supplier_id);
      if (supplier) {
        seen.add(supplier.id);
        list.push(supplier);
      }
      if (list.length >= 4) break;
    }
    if (list.length === 0) return suppliers.slice(0, 4);
    return list;
  }, [orders, suppliers]);

  const usualPayment = useMemo(() => {
    const counts = new Map<string, number>();
    supplierOrders.forEach((order) => {
      const key = order.payment_terms ? PURCHASE_ORDER_PAYMENT_TERMS_LABELS[order.payment_terms].toLowerCase() : order.payment_method ? `pays ${paymentMethodLabel(order.payment_method).toLowerCase()}` : "";
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    return top ? `usually ${top[0].replace(/^pay on delivery$/, "pays on delivery")}` : "";
  }, [supplierOrders]);

  /* ---------------- totals ---------------- */

  const subtotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (num(line.unitCost) || 0), 0);
  const discountValue = Math.max(0, num(discount) || 0);
  const deliveryValue = Math.max(0, num(delivery) || 0);
  const total = Math.max(0, subtotal - discountValue + deliveryValue);
  const stockUnits = lines.filter((line) => line.lineType === "inventory" && line.affectsStock).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const zeroCostLines = lines.filter((line) => !(num(line.unitCost) && Number(num(line.unitCost)) > 0)).length;
  const supplierName = selectedSupplier?.name || (supplierMode === "oneoff" ? oneOffName.trim() : "");
  const hasWork = !saving && (lines.length > 0 || Boolean(title.trim()) || Boolean(notes.trim()) || Boolean(attachment));

  /* ---------------- save ---------------- */

  const validate = () => {
    if (!poNumber.trim()) return "The order needs a PO number.";
    if (!supplierName) return "Choose a supplier, or type a one-time supplier.";
    if (lines.length === 0) return "Add at least one item or general purchase.";
    for (const line of lines) {
      if (!line.name.trim()) return "Every line needs a name. Fill in or remove the empty line.";
      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return `"${line.name}" needs a quantity above 0.`;
      if (line.affectsStock && !Number.isInteger(quantity)) return `"${line.name}" adds to stock, so its quantity must be a whole number.`;
      const cost = num(line.unitCost);
      if (line.unitCost.trim() && (cost === null || cost < 0)) return `"${line.name}" has an invalid unit cost.`;
    }
    if (num(discount) !== null && (num(discount) as number) < 0) return "The discount must be 0 or more.";
    if (terms === "paid_now") {
      const paid = num(paidAmount);
      if (paid === null || paid <= 0) return "Enter the amount paid, or choose another payment option.";
    }
    return "";
  };

  const save = async (mode: "draft" | "ordered") => {
    if (saving) return;
    const problem = validate();
    setFormError(problem);
    if (problem) return;
    setSaving(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentLabel: string | null = null;
      if (attachment) {
        const uploaded = await uploadPurchaseOrderAttachment(userId, attachment);
        attachmentUrl = uploaded.url;
        attachmentLabel = uploaded.label;
      }
      const orderLines: PurchaseOrderLineInput[] = lines.map((line) => ({
        line_type: line.lineType,
        inventory_item_id: line.lineType === "inventory" ? line.inventoryItemId : null,
        affects_stock: line.lineType === "inventory" ? line.affectsStock : false,
        expense_category: line.lineType === "expense" ? line.expenseCategory : null,
        name_snapshot: line.name.trim(),
        sku_snapshot: line.sku,
        item_code_snapshot: line.itemCode,
        unit_label_snapshot: line.unitLabel,
        quantity: Number(line.quantity),
        unit_cost: num(line.unitCost),
        notes: line.note.trim() || null,
      }));
      const paidNow = terms === "paid_now" ? num(paidAmount) || 0 : 0;
      const placing = mode === "ordered" || receiveNow;
      const fields = {
        po_number: poNumber.trim(),
        title: title.trim() || null,
        supplier_id: selectedSupplier?.id ?? null,
        supplier_name_snapshot: supplierName || null,
        supplier_contact_snapshot: selectedSupplier
          ? [selectedSupplier.contact_name, selectedSupplier.email, selectedSupplier.phone].filter(Boolean).join(" | ") || null
          : oneOffContact.trim() || null,
        depot_id: selectedDepot?.id ?? null,
        depot_name_snapshot: selectedDepot ? formatDepotLabel(selectedDepot) : null,
        purchase_date: today(),
        expected_delivery_date: expected || null,
        payment_terms: terms,
        payment_method: terms === "paid_now" ? paidMethod : null,
        paid_by: terms === "paid_now" ? paidBy.trim() || null : null,
        currency_code: currencyCode,
        exchange_rate: exchangeRate ?? 1,
        notes: notes.trim() || null,
        discount: discountValue,
        delivery_fee: deliveryValue,
        ...(attachmentUrl ? { attachment_url: attachmentUrl, attachment_label: attachmentLabel } : {}),
      };

      let orderId: number;
      if (editingId) {
        await updateDraftPurchaseOrder(userId, editingId, fields, orderLines);
        orderId = editingId;
        await logPurchaseOrderActivity(userId, orderId, "edited", "Draft edited");
        if (paidNow > 0) {
          const { addPurchaseOrderPayment } = await import("@/app/lib/purchaseOrders");
          await addPurchaseOrderPayment(orderId, { amount: paidNow, method: paidMethod, paid_by: paidBy });
        }
        if (placing && !receiveNow) await markPurchaseOrderOrdered(userId, orderId);
      } else {
        // "Already received" saves as a draft first and receives everything
        // right after, the same path as before (receive_purchase_order).
        orderId = await createPurchaseOrder(
          userId,
          {
            ...fields,
            status: placing && !receiveNow ? "ordered" : "draft",
            ordered_at: placing && !receiveNow ? new Date().toISOString() : null,
            payment_status: "unpaid",
            amount_paid: paidNow || null,
          },
          orderLines
        );
        await logPurchaseOrderActivity(userId, orderId, "created", mode === "draft" && !receiveNow ? "Draft created" : "Order created");
      }
      if (placing && !receiveNow) await logPurchaseOrderActivity(userId, orderId, "placed", "Order placed");
      if (receiveNow) {
        try {
          await receivePurchaseOrder(orderId);
        } catch {
          showToast({ tone: "danger", message: "The order was saved, but the stock could not be added. Receive it from the order page." });
        }
      }
      rememberDepotId(depotId);
      if (terms === "paid_now") rememberPaymentMethod(paidMethod);
      try {
        window.localStorage.removeItem(AUTOSAVE_KEY);
      } catch {
        // Not stored anyway.
      }
      showToast({
        tone: "success",
        message: receiveNow ? `${poNumber} saved and added to stock` : mode === "draft" ? `${poNumber} saved as a draft` : `${poNumber} placed`,
      });
      router.push(`/dashboard/purchase-orders/${orderId}`);
    } catch (error) {
      setFormError(
        isPurchaseOrdersSchemaMissing(error)
          ? "Purchase orders are not set up in this database yet."
          : error instanceof Error && /duplicate|unique/i.test(error.message)
            ? `The number ${poNumber} is already used. Change it and save again.`
            : "The order could not be saved. Check the fields and try again."
      );
      setSaving(false);
    }
  };

  const previewPdf = async () => {
    await exportPurchaseOrderPdf({
      details: {
        poNumber: poNumber || "Draft",
        title: title || undefined,
        supplierName: supplierName || "Not set",
        supplierContactName: selectedSupplier?.contact_name || undefined,
        supplierPhone: selectedSupplier?.phone || undefined,
        supplierEmail: selectedSupplier?.email || undefined,
        supplierContact: supplierMode === "oneoff" ? oneOffContact : undefined,
        depotName: selectedDepot?.name,
        depotAddress: selectedDepot?.address || undefined,
        depotPhone: selectedDepot?.phone || undefined,
        purchaseDate: today(),
        expectedDeliveryDate: expected || undefined,
        status: "Draft",
        statusKey: "draft",
        paymentTermsLabel: PURCHASE_ORDER_PAYMENT_TERMS_LABELS[terms],
        discount: discountValue,
        deliveryFee: deliveryValue,
        notes: notes || undefined,
        internalReference: title || undefined,
        preparedBy: people?.get(userId) || undefined,
      },
      lines: lines.map((line) => ({
        name: line.name || "Unnamed line",
        code: line.itemCode || line.sku || undefined,
        unit: line.unitLabel || "unit",
        imageUrl: line.image,
        orderQuantity: Number(line.quantity) || 0,
        unitCost: num(line.unitCost),
        lineTotal: (Number(line.quantity) || 0) * (num(line.unitCost) || 0),
        isGeneral: line.lineType === "expense",
        category: line.lineType === "expense" ? PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS[line.expenseCategory] : undefined,
      })),
      branding: brandingFromSettings(settings),
      currencyCode,
    });
  };

  /* ---------------- render ---------------- */

  if (loading) {
    return (
      <DashboardPageShell as="main">
        <LoadingSkeletonGroup count={4} itemClassName="min-h-28" />
      </DashboardPageShell>
    );
  }

  if (!capabilities.purchaseOrders) {
    return (
      <DashboardPageShell as="main">
        <LockedFeaturePanel
          feature="Purchase orders"
          benefit="Record every purchase with its cost, payment status and invoice, then receive the stock straight into your depot."
          currentPlan={formatPlanName(subscription.plan)}
          requiredPlan="Standard"
          source="purchase-orders"
        />
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell as="main" className="pon-v2">
      <Link href="/dashboard/purchase-orders" className="po-v2-back">
        ← Purchase orders
      </Link>
      <header className="pon-v2-head">
        <h1>{editingId ? "Edit draft" : "New purchase order"}</h1>
        {editingNumber ? (
          <input
            autoFocus
            value={poNumber}
            onChange={(event) => {
              setPoNumber(event.target.value);
              setPoNumberEdited(true);
            }}
            onBlur={() => setEditingNumber(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setEditingNumber(false);
            }}
            aria-label="PO number"
            className="ui-input pon-v2-number-input is-mono"
          />
        ) : (
          <button type="button" onClick={() => setEditingNumber(true)} className="pon-v2-number is-mono" title="Change the number">
            {poNumber || "…"} <UiIcon name="edit" className="h-3.5 w-3.5" />
          </button>
        )}
        <span className="pon-v2-saved">{editingId ? "Draft" : autosavedAt ? "Draft · autosaved on this computer" : ""}</span>
      </header>

      {loadError && <DashboardNotice tone="danger">{loadError}</DashboardNotice>}

      <div className="pon-v2-grid">
        <div className="pon-v2-main">
          {/* 1. Supplier */}
          <section className="po-v2-card pon-v2-section motion-enter">
            <h2>
              <span className="pon-v2-step">1</span> Supplier
            </h2>
            {supplierMode === "saved" && selectedSupplier && !supplierPicking ? (
              <div className="pon-v2-supplier">
                <span className="pon-v2-avatar">{selectedSupplier.name.charAt(0).toUpperCase()}</span>
                <span className="pon-v2-supplier-text">
                  <strong>{selectedSupplier.name}</strong>
                  <small>
                    {[
                      selectedSupplier.contact_name,
                      selectedSupplier.phone,
                      lastOrder ? `last order ${shortDate(lastOrder.purchase_date || lastOrder.created_at)}` : "first order",
                      usualPayment,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <button type="button" onClick={() => setSupplierPicking(true)} className={buttonClassName({ variant: "secondary" })}>
                  Change
                </button>
              </div>
            ) : supplierMode === "oneoff" ? (
              <div className="pon-v2-oneoff">
                <label>
                  Supplier name
                  <input value={oneOffName} onChange={(event) => setOneOffName(event.target.value)} placeholder="e.g. Hamra market stall" className="ui-input" autoFocus />
                </label>
                <label>
                  Contact (optional)
                  <input value={oneOffContact} onChange={(event) => setOneOffContact(event.target.value)} placeholder="Name or phone" className="ui-input" />
                </label>
              </div>
            ) : (
              <div className="pon-v2-pick">
                <Select
                  ariaLabel="Supplier"
                  value={supplierId}
                  onChange={chooseSupplier}
                  searchable
                  searchPlaceholder="Find a supplier"
                  placeholder={suppliers.length ? "Choose a supplier" : "No suppliers yet — add one"}
                  options={suppliers.map((entry) => ({ value: String(entry.id), label: entry.name, description: entry.phone || entry.contact_name || undefined }))}
                />
              </div>
            )}

            {newSupplierOpen && (
              <div className="pon-v2-new-supplier">
                <input value={newSupplier.name} onChange={(event) => setNewSupplier({ ...newSupplier, name: event.target.value })} placeholder="Supplier name" aria-label="New supplier name" className="ui-input" autoFocus />
                <input value={newSupplier.contact_name} onChange={(event) => setNewSupplier({ ...newSupplier, contact_name: event.target.value })} placeholder="Contact person" aria-label="Contact person" className="ui-input" />
                <input value={newSupplier.phone} onChange={(event) => setNewSupplier({ ...newSupplier, phone: event.target.value })} placeholder="Phone" aria-label="Phone" inputMode="tel" className="ui-input" />
                <button type="button" onClick={() => setNewSupplierOpen(false)} className={buttonClassName({ variant: "secondary" })}>
                  Cancel
                </button>
                <button type="button" disabled={creatingSupplier || !newSupplier.name.trim()} onClick={() => void saveNewSupplier()} className={buttonClassName()}>
                  {creatingSupplier ? "Adding…" : "Add supplier"}
                </button>
              </div>
            )}

            <div className="pon-v2-chips">
              <span>Recent:</span>
              {recentSuppliers.map((entry) => (
                <button key={entry.id} type="button" onClick={() => chooseSupplier(String(entry.id))} className={`pon-v2-chip ${supplierMode === "saved" && supplierId === String(entry.id) ? "is-active" : ""}`}>
                  {entry.name}
                </button>
              ))}
              <button type="button" onClick={() => setNewSupplierOpen(true)} className="pon-v2-chip is-dashed">
                + New supplier
              </button>
              <button
                type="button"
                onClick={() => {
                  setSupplierMode(supplierMode === "oneoff" ? "saved" : "oneoff");
                  setSupplierPicking(false);
                }}
                className="pon-v2-text"
              >
                {supplierMode === "oneoff" ? "Pick a saved supplier" : "One-time supplier (free text)"}
              </button>
            </div>
          </section>

          {/* 2. Items */}
          <section className="po-v2-card pon-v2-section motion-enter" style={{ animationDelay: "60ms" }}>
            <div className="pon-v2-section-head">
              <h2>
                <span className="pon-v2-step">2</span> Items
              </h2>
              <div className="pon-v2-quick">
                {alertItems.length > 0 && (
                  <button type="button" onClick={addFromAlerts} className={`${buttonClassName({ variant: "secondary" })} pon-v2-alerts-btn`}>
                    From stock alerts · {alertItems.length}
                  </button>
                )}
                <button type="button" disabled={!lastOrder} title={lastOrder ? `Copy ${lastOrder.po_number}` : "Choose a supplier with a past order"} onClick={() => void repeatLastOrder()} className={buttonClassName({ variant: "secondary" })}>
                  Repeat last order
                </button>
              </div>
            </div>

            <div className="pon-v2-search-row">
              <label className="pon-v2-search">
                <UiIcon name="search" className="h-4 w-4" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setHighlight((current) => Math.min(current + 1, results.length - 1));
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setHighlight((current) => Math.max(current - 1, 0));
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      if (results[highlight]) addItem(results[highlight]);
                      else if (query.trim()) void addByCode(query);
                    } else if (event.key === "Escape") {
                      setSearchOpen(false);
                    }
                  }}
                  placeholder="Add item — type name or code, or scan a barcode"
                  aria-label="Add item"
                  role="combobox"
                  aria-controls="pon-v2-results"
                  aria-expanded={searchOpen && results.length > 0}
                />
                <kbd>/</kbd>
                {searchOpen && results.length > 0 && (
                  <ul id="pon-v2-results" className="pon-v2-results" role="listbox">
                    {results.map((item, index) => (
                      <li key={item.id} role="option" aria-selected={index === highlight}>
                        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addItem(item)} onMouseEnter={() => setHighlight(index)} className={index === highlight ? "is-active" : ""}>
                          <span className="po-v2-thumb">
                            {item.image ? <ProductThumbnail src={item.image} alt="" sizes="36px" imgClassName="object-cover" iconClassName="h-4 w-4" fallbackClassName="flex h-full w-full items-center justify-center" /> : item.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="pon-v2-result-text">
                            <strong>{item.name}</strong>
                            <small>
                              <span className="is-mono">{item.item_code || item.sku || ""}</span> {contextFor(item)}
                            </small>
                          </span>
                          {lines.some((line) => line.inventoryItemId === item.id) && <span className="pon-v2-in-order">In order</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </label>
              <button type="button" onClick={() => setScannerOpen(true)} aria-label="Scan with the camera" className={`${buttonClassName({ variant: "secondary" })} pon-v2-scan`}>
                <UiIcon name="scan" className="h-5 w-5" />
              </button>
            </div>

            {lines.length > 0 && (
              <div className="po-v2-table-wrap">
                <table className="po-v2-table pon-v2-lines">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit cost</th>
                      <th>To stock</th>
                      <th className="is-num">Total</th>
                      <th aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const qty = Number(line.quantity) || 0;
                      const cost = num(line.unitCost) || 0;
                      return (
                        <tr key={line.key}>
                          <td>
                            {line.lineType === "expense" ? (
                              <span className="pon-v2-general">
                                <input value={line.name} onChange={(event) => updateLine(line.key, { name: event.target.value })} placeholder="What was bought, e.g. Cleaning supplies" aria-label="General purchase description" className="ui-input" />
                                <Select
                                  ariaLabel="Category"
                                  value={line.expenseCategory}
                                  onChange={(value) => updateLine(line.key, { expenseCategory: value as PurchaseOrderExpenseCategory })}
                                  options={(Object.keys(PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS) as PurchaseOrderExpenseCategory[]).map((key) => ({ value: key, label: PURCHASE_ORDER_EXPENSE_CATEGORY_LABELS[key] }))}
                                />
                              </span>
                            ) : (
                              <span className="po-v2-item">
                                <span className="po-v2-thumb">
                                  {line.image ? <ProductThumbnail src={line.image} alt="" sizes="40px" imgClassName="object-cover" iconClassName="h-4 w-4" fallbackClassName="flex h-full w-full items-center justify-center" /> : line.name.charAt(0).toUpperCase()}
                                </span>
                                <span>
                                  <span className="po-v2-item-name">{line.name}</span>
                                  <small>
                                    <span className="is-mono">{line.itemCode || line.sku || ""}</span>
                                    {line.context ? ` · ${line.context}` : ""}
                                  </small>
                                </span>
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="alerts-v2-stepper">
                              <button type="button" disabled={qty <= 1} onClick={() => updateLine(line.key, { quantity: String(Math.max(1, qty - 1)) })} aria-label={`One less ${line.name}`}>
                                −
                              </button>
                              <input value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" aria-label={`Quantity of ${line.name}`} className="pon-v2-qty" />
                              <button type="button" onClick={() => updateLine(line.key, { quantity: String(qty + 1) })} aria-label={`One more ${line.name}`}>
                                +
                              </button>
                            </span>
                          </td>
                          <td>
                            <span className="pon-v2-cost">
                              <span className="pon-v2-money">
                                <span>{currencyCode === "USD" ? "$" : currencyCode}</span>
                                <input value={line.unitCost} onChange={(event) => updateLine(line.key, { unitCost: event.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="0.00" aria-label={`Unit cost of ${line.name}`} />
                              </span>
                              {line.costHint && <small>{line.costHint}</small>}
                            </span>
                          </td>
                          <td>
                            {line.lineType === "inventory" ? (
                              <label className="scanner-v2-toggle pon-v2-switch">
                                <input type="checkbox" role="switch" checked={line.affectsStock} onChange={(event) => updateLine(line.key, { affectsStock: event.target.checked })} aria-label={`${line.name} adds to stock`} />
                                <span className="scanner-v2-switch" aria-hidden />
                              </label>
                            ) : (
                              <small className="pon-v2-muted">Not stock</small>
                            )}
                          </td>
                          <td className="is-num is-mono is-strong">{money(qty * cost)}</td>
                          <td>
                            <button type="button" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))} aria-label={`Remove ${line.name || "line"}`} className="scanner-v2-line-remove">
                              <UiIcon name="close" className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pon-v2-general-row">
              <button type="button" onClick={addGeneralLine} className="pon-v2-chip is-dashed">
                + General purchase (not stock)
              </button>
              <span>e.g. &quot;Cleaning supplies&quot;, &quot;New AC unit&quot; — counted in spending, not in inventory</span>
            </div>

            <div className="po-v2-sums pon-v2-sums">
              <div>
                <span>Subtotal</span>
                <b className="is-mono">{money(subtotal)}</b>
              </div>
              <div>
                <span>Discount</span>
                <span className="pon-v2-money is-small">
                  <span>−{currencyCode === "USD" ? "$" : currencyCode}</span>
                  <input value={discount} onChange={(event) => setDiscount(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0.00" aria-label="Discount" />
                </span>
              </div>
              <div>
                <span>Delivery fee</span>
                <span className="pon-v2-money is-small">
                  <span>+{currencyCode === "USD" ? "$" : currencyCode}</span>
                  <input value={delivery} onChange={(event) => setDelivery(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0.00" aria-label="Delivery fee" />
                </span>
              </div>
              <div className="is-total">
                <span>Total</span>
                <b className="is-mono">{money(total)}</b>
              </div>
            </div>
          </section>

          {/* 3. Delivery & payment */}
          <section className="po-v2-card pon-v2-section motion-enter" style={{ animationDelay: "120ms" }}>
            <h2>
              <span className="pon-v2-step">3</span> Delivery &amp; payment
            </h2>
            <div className="pon-v2-fields">
              <label>
                Deliver to
                <Select
                  ariaLabel="Deliver to depot"
                  value={depotId}
                  onChange={setDepotId}
                  options={[{ value: "", label: "No depot / general" }, ...depots.map((depot) => ({ value: String(depot.id), label: formatDepotLabel(depot) }))]}
                />
              </label>
              <label>
                Expected delivery
                <input type="date" value={expected} onChange={(event) => setExpected(event.target.value)} className="ui-input" />
              </label>
              <label>
                Reference / title
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Restock from alerts" className="ui-input" />
              </label>
            </div>

            <p className="pon-v2-label">Payment</p>
            <div className="pon-v2-terms" role="radiogroup" aria-label="Payment">
              {TERMS.map((key) => (
                <button key={key} type="button" role="radio" aria-checked={terms === key} onClick={() => {
                  setTerms(key);
                  if (key === "paid_now" && !paidAmount) setPaidAmount(total > 0 ? String(Math.round(total * 100) / 100) : "");
                  if (key === "paid_now" && !paidBy) setPaidBy(people?.get(userId) || "");
                }} className={terms === key ? "is-active" : ""}>
                  {PURCHASE_ORDER_PAYMENT_TERMS_LABELS[key]}
                </button>
              ))}
            </div>
            {terms === "paid_now" && (
              <div className="pon-v2-fields is-paid">
                <label>
                  Amount paid
                  <input value={paidAmount} onChange={(event) => setPaidAmount(event.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="ui-input" />
                </label>
                <label>
                  Method
                  <Select ariaLabel="Payment method" value={paidMethod} onChange={setPaidMethod} options={paymentMethodOptions(settings.payment_methods, paidMethod)} />
                </label>
                <label>
                  Paid by
                  <input value={paidBy} onChange={(event) => setPaidBy(event.target.value)} className="ui-input" />
                </label>
              </div>
            )}

            <div className="pon-v2-extras">
              <input ref={attachmentRef} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
              <button type="button" onClick={() => attachmentRef.current?.click()} className={buttonClassName({ variant: "secondary" })}>
                <UiIcon name="upload" className="h-4 w-4" />
                {attachment ? attachment.name.slice(0, 28) : "Attach supplier invoice"}
              </button>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes for the supplier (printed on the PDF)" aria-label="Notes for the supplier" className="ui-input" />
              <label className="pon-v2-currency">
                Currency
                <Select ariaLabel="Currency" value={currencyCode} onChange={(value) => setOrderCurrency(value)} options={currencyChoicesIncluding(baseCurrency, settings.currency_code, currencyCode)} />
              </label>
            </div>
          </section>
        </div>

        {/* Live summary */}
        <aside className="pon-v2-summary">
          <div className="pon-v2-sheet">
            <div className="pon-v2-sheet-head">
              <div>
                <strong>{settings.business_name || "Your business"}</strong>
                <small>Purchase order</small>
              </div>
              <div className="is-right">
                <strong className="is-mono">{poNumber}</strong>
                <small>{shortDate(today())}, {new Date().getFullYear()}</small>
              </div>
            </div>
            <div className="pon-v2-sheet-body">
              <div className="pon-v2-sheet-parties">
                <div>
                  <span>Supplier</span>
                  <strong>{supplierName || "Not chosen"}</strong>
                </div>
                <div className="is-right">
                  <span>Deliver to</span>
                  <strong>{selectedDepot?.name || "—"}</strong>
                </div>
              </div>
              <ul>
                {lines.length === 0 && <li className="is-empty">No lines yet</li>}
                {lines.map((line) => (
                  <li key={line.key}>
                    <span>
                      {line.quantity || 0} × {line.name || "General purchase"}
                    </span>
                    <span className="is-mono">{money((Number(line.quantity) || 0) * (num(line.unitCost) || 0))}</span>
                  </li>
                ))}
              </ul>
              <div className="pon-v2-sheet-total">
                <span>Total</span>
                <strong className="is-mono">{money(total)}</strong>
              </div>
              {stockUnits > 0 && (
                <p>
                  {stockUnits} {stockUnits === 1 ? "unit" : "units"} will be added to stock{selectedDepot ? ` in ${selectedDepot.name}` : ""} when received.
                </p>
              )}
            </div>
          </div>
          <button type="button" disabled={lines.length === 0} onClick={() => void previewPdf()} className="po-v2-link pon-v2-preview">
            Preview full PDF →
          </button>
        </aside>
      </div>

      <div className="pon-v2-bar-spacer" aria-hidden />
      <div className="pon-v2-bar">
        <span className="pon-v2-bar-text">
          <strong className="is-mono">{poNumber}</strong>
          <small>
            {lines.length} {lines.length === 1 ? "line" : "lines"} · {money(total)}
            {zeroCostLines > 0 && lines.length > 0 ? ` · ${zeroCostLines} without a cost` : ""}
          </small>
        </span>
        {formError && <span className="pon-v2-bar-error" role="alert">{formError}</span>}
        <label className="po-v2-check">
          <input type="checkbox" checked={receiveNow} onChange={(event) => setReceiveNow(event.target.checked)} />
          Goods already received — add to stock now
        </label>
        <Link href="/dashboard/purchase-orders" className="pon-v2-text">
          Cancel
        </Link>
        {!receiveNow && (
          <button type="button" disabled={saving} onClick={() => void save("draft")} className={buttonClassName({ variant: "secondary" })}>
            Save draft
          </button>
        )}
        <button type="button" disabled={saving} onClick={() => void save("ordered")} className={buttonClassName()}>
          {saving ? "Saving…" : receiveNow ? "Save & add to stock" : "Place order"}
        </button>
      </div>

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDecode={(text) => {
          setScannerOpen(false);
          void addByCode(text);
        }}
        eyebrow="Purchase order"
        title="Scan an item"
        description="Scan a product barcode or SydIN QR to add it to this order."
      />
      {/* New orders are autosaved on this computer, so only an edited draft asks before leaving. */}
      <UnsavedChangesGuard when={hasWork && Boolean(editingId)} what="this draft" />
    </DashboardPageShell>
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={null}>
      <NewPurchaseOrder />
    </Suspense>
  );
}
