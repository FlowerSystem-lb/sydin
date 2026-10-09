"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import ProductThumbnail from "@/components/inventory/ProductThumbnail";
import ScannerModal from "@/components/scanner/ScannerModal";
import { useKeyboardWedge } from "@/components/scanner/useKeyboardWedge";
import { useScanSound } from "@/components/scanner/useScanSound";
import { buttonClassName, UnsavedChangesGuard, useToast } from "@/components/ui";
import Select from "@/components/ui/Select";
import { DashboardNotice, DashboardPageShell, LoadingSkeletonGroup } from "@/components/dashboard/Workspace";
import { useBusinessPeople } from "@/components/dashboard/DoneBy";
import { getBusinessUser } from "@/app/lib/business";
import { supabase } from "@/app/lib/supabase";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { brandingFromSettings } from "@/app/lib/documentPdf";
import { formatDepotLabel, getActiveDepotsForUser, type Depot } from "@/app/lib/depots";
import { getSuppliersForUser, type Supplier } from "@/app/lib/suppliers";
import { getInventoryUnitLabel, normalizeCurrencyCode } from "@/app/lib/inventoryItemModel";
import { formatExactPrice, getCurrencyContext } from "@/app/lib/currency";
import {
  getPurchaseOrder,
  logPurchaseOrderActivity,
  uploadPurchaseOrderAttachment,
  type PurchaseOrder,
} from "@/app/lib/purchaseOrders";
import {
  NO_ORDER_REASONS,
  confirmStockReceipt,
  getReceipt,
  localDateStamp,
  reasonLabel,
  type ConfirmReceiptResult,
  type ReceiptSource,
  type ShortAction,
} from "@/app/lib/stockReceipts";
import { exportStockReceiptPdf } from "@/app/lib/stockReceiptPdf";
import { getPurchaseOrderPublicUrl } from "@/app/lib/purchaseOrderDocuments";

/*
 * Receiving (9 Oct 2026, Sayed's Stock in spec): one screen instead of the
 * four-step wizard. Count what arrived against the order (or with no order /
 * as a customer return), mark damaged units, change a price, add a batch or
 * expiry, decide what happens to what is missing, and confirm. Confirm is one
 * database transaction (confirm_stock_receipt). The done view says what
 * happened, offers the GRN PDF, shelf labels and a WhatsApp message to the
 * supplier about any difference.
 */

interface ItemRow {
  id: number;
  name: string;
  image: string | null;
  quantity: number;
  sku: string | null;
  item_code: string | null;
  barcode: string | null;
  public_id: string | null;
  unit_type: string | null;
  custom_unit_label: string | null;
  cost_price: number | string | null;
}

interface CountLine {
  key: string;
  poLineId: number | null;
  itemId: number | null;
  name: string;
  code: string;
  unit: string;
  image: string | null;
  nowInStock: number | null;
  expected: number | null;
  received: string;
  damaged: string;
  unitCost: string;
  poUnitCost: number | null;
  batch: string;
  expiry: string;
  affectsStock: boolean;
}

const ITEM_SELECT = "id, name, image, quantity, sku, item_code, barcode, public_id, unit_type, custom_unit_label, cost_price";

function key() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function nowLocalInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function n(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : 0;
}

/** Lebanese numbers typed locally → wa.me digits. */
function whatsappDigits(phone?: string | null) {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("961")) return digits;
  digits = digits.replace(/^0+/, "");
  return digits.length <= 8 ? `961${digits}` : digits;
}

function Receiving() {
  const router = useRouter();
  const { showToast } = useToast();
  const people = useBusinessPeople();
  const play = useScanSound({ enabled: true });
  const photoRef = useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [source, setSource] = useState<ReceiptSource>("no_order");
  const [nextReference, setNextReference] = useState("");

  const [lines, setLines] = useState<CountLine[]>([]);
  const [depotId, setDepotId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState("");
  const [deliveryNoteNo, setDeliveryNoteNo] = useState("");
  const [receivedAt, setReceivedAt] = useState(nowLocalInput);
  const [receivedBy, setReceivedBy] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [blind, setBlind] = useState(false);
  const [shortAction, setShortAction] = useState<ShortAction>("backorder");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemRow[]>([]);
  const [bumped, setBumped] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState<ConfirmReceiptResult | null>(null);
  const [doneLines, setDoneLines] = useState<CountLine[]>([]);
  const draftKey = order ? `sydin:receiving-draft:po-${order.id}` : `sydin:receiving-draft:${source}`;

  const currency = order ? normalizeCurrencyCode(order.currency_code, getCurrencyContext().base) : getCurrencyContext().base;
  const money = useCallback((value: number) => formatExactPrice(value, currency) || "—", [currency]);

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
      const params = new URLSearchParams(window.location.search);
      const poId = Number(params.get("po"));
      const requestedSource = params.get("source");
      const [loadedSettings, loadedDepots, loadedSuppliers, todayCount] = await Promise.all([
        getOrCreateBusinessSettings(user.id),
        getActiveDepotsForUser(user.id).catch(() => [] as Depot[]),
        getSuppliersForUser(user.id).catch(() => [] as Supplier[]),
        supabase
          .from("purchase_order_receipts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .like("reference", `RCV-${localDateStamp()}-%`),
      ]);
      if (!active) return;
      setUserId(user.id);
      setSettings(loadedSettings);
      setDepots(loadedDepots);
      setSuppliers(loadedSuppliers);
      setNextReference(`RCV-${localDateStamp()}-${String((todayCount.count || 0) + 1).padStart(2, "0")}`);

      if (Number.isFinite(poId) && poId > 0) {
        const loaded = await getPurchaseOrder(user.id, poId);
        if (!active) return;
        if (!loaded) throw new Error("This purchase order was not found.");
        if (!["draft", "ordered", "partially_received"].includes(loaded.status)) {
          throw new Error(`${loaded.po_number} is ${loaded.status.replace("_", " ")} and cannot take another delivery.`);
        }
        setOrder(loaded);
        setSource("po");
        setDepotId(loaded.depot_id ? String(loaded.depot_id) : "");
        const itemIds = loaded.lines.map((line) => line.inventory_item_id).filter((id): id is number => id !== null);
        const { data: items } = itemIds.length
          ? await supabase.from("inventory").select(ITEM_SELECT).eq("user_id", user.id).in("id", itemIds)
          : { data: [] };
        const byId = new Map(((items || []) as ItemRow[]).map((item) => [item.id, item]));
        const prepared = loaded.lines
          .filter((line) => line.quantity - line.received_quantity > 0)
          .map((line) => {
            const item = line.inventory_item_id ? byId.get(line.inventory_item_id) : undefined;
            return {
              key: key(),
              poLineId: line.id,
              itemId: line.inventory_item_id,
              name: line.name_snapshot,
              code: line.item_code_snapshot || line.sku_snapshot || "",
              unit: line.unit_label_snapshot || (item ? getInventoryUnitLabel(item.unit_type, item.custom_unit_label) : "unit"),
              image: item?.image || null,
              nowInStock: item ? Number(item.quantity) : null,
              expected: line.quantity - line.received_quantity,
              received: "",
              damaged: "",
              unitCost: line.unit_cost === null ? "" : String(line.unit_cost),
              poUnitCost: line.unit_cost,
              batch: "",
              expiry: "",
              affectsStock: line.affects_stock,
            } as CountLine;
          });
        // A saved count for this order comes back.
        try {
          const saved = JSON.parse(window.localStorage.getItem(`sydin:receiving-draft:po-${loaded.id}`) || "null");
          if (saved?.lines) {
            const savedByLine = new Map((saved.lines as CountLine[]).map((line) => [line.poLineId, line]));
            setLines(prepared.map((line) => ({ ...line, ...(savedByLine.get(line.poLineId) || {}), key: line.key })));
            setDeliveryNoteNo(saved.deliveryNoteNo || "");
            setShortAction(saved.shortAction || "backorder");
          } else setLines(prepared);
        } catch {
          setLines(prepared);
        }
      } else {
        const chosen: ReceiptSource = requestedSource === "return" ? "return" : "no_order";
        setSource(chosen);
        const defaultDepot = loadedDepots.find((depot) => depot.is_default)?.id;
        setDepotId(defaultDepot ? String(defaultDepot) : "");
        // Inventory's "Receive stock" on selected items (?items=1,2).
        const preset = (params.get("items") || "").split(",").map(Number).filter((id) => id > 0);
        if (preset.length) {
          const { data: presetItems } = await supabase.from("inventory").select(ITEM_SELECT).eq("user_id", user.id).in("id", preset);
          if (!active) return;
          setLines(
            ((presetItems || []) as ItemRow[]).map((item) => ({
              key: key(),
              poLineId: null,
              itemId: item.id,
              name: item.name,
              code: item.item_code || item.sku || "",
              unit: getInventoryUnitLabel(item.unit_type, item.custom_unit_label),
              image: item.image,
              nowInStock: Number(item.quantity),
              expected: null,
              received: "",
              damaged: "",
              unitCost: item.cost_price === null || item.cost_price === "" ? "" : String(item.cost_price),
              poUnitCost: null,
              batch: "",
              expiry: "",
              affectsStock: true,
            }))
          );
        } else try {
          const saved = JSON.parse(window.localStorage.getItem(`sydin:receiving-draft:${chosen}`) || "null");
          if (saved?.lines?.length) {
            setLines(saved.lines);
            setReason(saved.reason || "");
            setSupplierId(saved.supplierId || "");
            if (saved.depotId) setDepotId(saved.depotId);
          }
        } catch {
          // Nothing saved.
        }
      }
      setLoading(false);
    })().catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : "This delivery could not be loaded.");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!receivedBy && userId && people?.get(userId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- default "received by" once the team's names arrive
      setReceivedBy(people.get(userId) || "");
    }
  }, [people, receivedBy, userId]);

  /* ---------------- items (no order / return / scan) ---------------- */

  useEffect(() => {
    if (!userId || order || !query.trim()) {
      return;
    }
    let active = true;
    const term = query.trim().replace(/[%,()]/g, " ").slice(0, 60);
    const timer = window.setTimeout(async () => {
      const { data } = await supabase
        .from("inventory")
        .select(ITEM_SELECT)
        .eq("user_id", userId)
        .or(`name.ilike.%${term}%,sku.ilike.%${term}%,item_code.ilike.%${term}%,barcode.ilike.%${term}%`)
        .order("name")
        .limit(8);
      if (active) setResults((data || []) as ItemRow[]);
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [order, query, userId]);

  const bump = (lineKey: string) => {
    setBumped(lineKey);
    window.setTimeout(() => setBumped((current) => (current === lineKey ? null : current)), 260);
  };

  const addItemLine = useCallback((item: ItemRow) => {
    setLines((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      if (existing) {
        return current.map((line) => (line.key === existing.key ? { ...line, received: String(n(line.received) + 1) } : line));
      }
      return [
        ...current,
        {
          key: key(),
          poLineId: null,
          itemId: item.id,
          name: item.name,
          code: item.item_code || item.sku || "",
          unit: getInventoryUnitLabel(item.unit_type, item.custom_unit_label),
          image: item.image,
          nowInStock: Number(item.quantity),
          expected: null,
          received: "1",
          damaged: "",
          unitCost: item.cost_price === null || item.cost_price === "" ? "" : String(item.cost_price),
          poUnitCost: null,
          batch: "",
          expiry: "",
          affectsStock: true,
        },
      ];
    });
    setQuery("");
    setResults([]);
  }, []);

  /** A scanned code: +1 on the matching line (PO), or a new line (no order). */
  const handleCode = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || !userId) return;
      const publicId = code.match(/item\/([0-9a-f-]{36})/i)?.[1];
      const safe = code.replace(/[%,()]/g, "");
      const { data } = await supabase
        .from("inventory")
        .select(ITEM_SELECT)
        .eq("user_id", userId)
        .or(publicId ? `public_id.eq.${publicId}` : `barcode.eq.${safe},item_code.ilike.${safe},sku.eq.${safe}`)
        .limit(2);
      const found = (data || []) as ItemRow[];
      if (found.length !== 1) {
        play("error");
        showToast({ tone: "danger", message: found.length > 1 ? `${found.length} items share ${code}` : `No item with the code ${code}` });
        return;
      }
      const item = found[0];
      if (order) {
        const line = lines.find((entry) => entry.itemId === item.id);
        if (!line) {
          play("error");
          showToast({ tone: "danger", message: `${item.name} is not on ${order.po_number}` });
          return;
        }
        setLines((current) => current.map((entry) => (entry.key === line.key ? { ...entry, received: String(n(entry.received) + 1) } : entry)));
        bump(line.key);
      } else {
        addItemLine(item);
      }
      play("success");
    },
    [addItemLine, lines, order, play, showToast, userId]
  );

  useKeyboardWedge({ enabled: !loading && !done && !scannerOpen, onCode: (code) => void handleCode(code) });

  /* ---------------- figures ---------------- */

  const updateLine = (lineKey: string, patch: Partial<CountLine>) =>
    setLines((current) => current.map((line) => (line.key === lineKey ? { ...line, ...patch } : line)));

  const totals = useMemo(() => {
    const expected = lines.reduce((sum, line) => sum + (line.expected || 0), 0);
    const counted = lines.reduce((sum, line) => sum + n(line.received), 0);
    const damaged = lines.reduce((sum, line) => sum + Math.min(n(line.damaged), n(line.received)), 0);
    const short = lines.reduce((sum, line) => sum + Math.max((line.expected || 0) - n(line.received), 0), 0);
    const intoStock = lines.reduce((sum, line) => sum + (line.affectsStock ? Math.max(n(line.received) - Math.min(n(line.damaged), n(line.received)), 0) : 0), 0);
    const value = lines.reduce((sum, line) => sum + Math.max(n(line.received) - n(line.damaged), 0) * n(line.unitCost), 0);
    return { expected, counted, damaged, short, intoStock, value, percent: expected ? Math.min(100, Math.round((counted / expected) * 100)) : 0 };
  }, [lines]);

  const depot = depots.find((entry) => String(entry.id) === depotId) || null;
  const depotName = depot?.name || order?.depot_name_snapshot || "stock";
  const hasCounts = lines.some((line) => n(line.received) > 0);

  // Draft on this computer, 800ms after a change.
  useEffect(() => {
    if (loading || done) return;
    const timer = window.setTimeout(() => {
      try {
        if (!hasCounts) window.localStorage.removeItem(draftKey);
        else window.localStorage.setItem(draftKey, JSON.stringify({ lines, deliveryNoteNo, shortAction, reason, supplierId, depotId }));
      } catch {
        // Storage blocked.
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [deliveryNoteNo, depotId, done, draftKey, hasCounts, lines, loading, reason, shortAction, supplierId]);

  /* ---------------- confirm ---------------- */

  const confirm = async () => {
    if (saving) return;
    setFormError("");
    if (!hasCounts && !(order && shortAction === "close_short")) {
      setFormError("Count at least one line.");
      return;
    }
    if (source === "no_order" && !reason) {
      setFormError("Choose why this stock is coming in.");
      return;
    }
    for (const line of lines) {
      if (n(line.damaged) > n(line.received)) {
        setFormError(`${line.name}: damaged cannot be more than received.`);
        return;
      }
      if (line.affectsStock && !Number.isInteger(n(line.received) - n(line.damaged))) {
        setFormError(`${line.name}: stock quantities must be whole numbers.`);
        return;
      }
    }
    setSaving(true);
    try {
      let photoUrl: string | null = null;
      if (photo) photoUrl = (await uploadPurchaseOrderAttachment(userId, photo)).url;
      const supplier = suppliers.find((entry) => String(entry.id) === supplierId) || null;
      const result = await confirmStockReceipt(
        {
          source,
          poId: order?.id ?? null,
          reason: source === "no_order" ? reason : source === "return" ? "customer_return" : null,
          depotId: depotId ? Number(depotId) : null,
          supplierId: supplier?.id ?? null,
          supplierName: supplier?.name ?? null,
          deliveryNoteNo,
          deliveryNotePhoto: photoUrl,
          receivedAt: receivedAt ? new Date(receivedAt).toISOString() : null,
          receivedBy,
          shortAction: order ? shortAction : null,
        },
        lines
          .filter((line) => n(line.received) > 0)
          .map((line) => ({
            poLineId: line.poLineId,
            itemId: line.itemId,
            expected: line.expected,
            received: n(line.received),
            damaged: Math.min(n(line.damaged), n(line.received)),
            unitCost: line.unitCost.trim() === "" ? null : n(line.unitCost),
            batch: line.batch || null,
            expiryDate: line.expiry || null,
          }))
      );
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // Nothing stored.
      }
      setDoneLines(lines);
      setDone(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The receipt could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- done actions ---------------- */

  const supplier = order?.supplier_id ? suppliers.find((entry) => entry.id === order.supplier_id) : suppliers.find((entry) => String(entry.id) === supplierId);
  const supplierPhone = supplier?.whatsapp || supplier?.phone || "";
  const differences = doneLines
    .map((line) => {
      const parts: string[] = [];
      if (n(line.damaged) > 0) parts.push(`${n(line.damaged)} × ${line.name} damaged`);
      if (line.expected !== null && n(line.received) < line.expected) parts.push(`${line.expected - n(line.received)} × ${line.name} missing`);
      if (line.expected !== null && n(line.received) > line.expected) parts.push(`${n(line.received) - line.expected} × ${line.name} extra`);
      return parts;
    })
    .flat();

  const sendDifference = () => {
    if (!done) return;
    const message = `Hello ${supplier?.contact_name || supplier?.name || ""}, we received ${order ? order.po_number : "your delivery"} today (receipt ${done.reference}). ${differences.join(", ")}. Please advise.`.replace("Hello ,", "Hello,");
    window.open(`https://wa.me/${whatsappDigits(supplierPhone)}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    if (order) void logPurchaseOrderActivity(userId, order.id, "sent", `Sent the delivery difference to ${supplier?.name || "the supplier"} on WhatsApp`);
  };

  const printReceipt = async () => {
    if (!done?.receipt_id) return;
    const receipt = await getReceipt(userId, done.receipt_id);
    if (!receipt) return;
    await exportStockReceiptPdf({
      details: {
        reference: receipt.reference || receipt.receipt_number,
        poReference: receipt.po_reference,
        poNumber: order?.po_number,
        sourceLabel: receipt.source === "po" ? "Purchase order" : receipt.source === "return" ? "Customer return" : receipt.source === "scanner" ? "Scanner" : `No order · ${reasonLabel(receipt.reason)}`,
        receivedAt: receipt.received_at,
        receivedBy: receipt.received_by,
        supplierName: receipt.supplier_name || supplier?.name,
        supplierPhone: supplierPhone || null,
        depotName: depot?.name || order?.depot_name_snapshot,
        depotAddress: depot?.address,
        deliveryNoteNo: receipt.delivery_note_no,
        notes: receipt.notes,
        qrUrl: order ? getPurchaseOrderPublicUrl(order, window.location.origin) : `${window.location.origin}/dashboard/receiving`,
      },
      lines: receipt.lines.map((line) => ({
        name: line.item?.name || "Item",
        code: line.item?.item_code || line.item?.sku,
        unit: line.item ? getInventoryUnitLabel(line.item.unit_type, line.item.custom_unit_label) : null,
        imageUrl: line.item?.image,
        expected: line.expected_quantity,
        received: line.quantity,
        damaged: line.damaged_quantity,
        unitCost: line.unit_cost,
        batch: line.batch,
        expiryDate: line.expiry_date,
      })),
      branding: brandingFromSettings(settings),
      currencyCode: currency,
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

  if (loadError) {
    return (
      <DashboardPageShell as="main">
        <Link href="/dashboard/receiving" className="po-v2-back">
          ← Stock in
        </Link>
        <DashboardNotice tone="danger">{loadError}</DashboardNotice>
      </DashboardPageShell>
    );
  }

  if (done) {
    const shortLeft = order ? Number(done.outstanding || 0) : 0;
    const itemIds = doneLines.filter((line) => line.itemId && n(line.received) - n(line.damaged) > 0).map((line) => line.itemId);
    return (
      <DashboardPageShell as="main" className="rcv-v2">
        <section className="po-v2-card rcv-v2-done motion-enter">
          <span className="rcv-v2-check" aria-hidden>
            <UiIcon name="check" className="h-9 w-9" />
          </span>
          <h1>
            {done.good} {done.good === 1 ? "unit" : "units"} added to {depotName}
          </h1>
          <p>
            Receipt <b className="is-mono">{done.reference}</b> saved
            {order && (
              <>
                {" · "}
                <Link href={`/dashboard/purchase-orders/${order.id}`} className="po-v2-link is-mono">
                  {order.po_number}
                </Link>{" "}
                is now{" "}
                <b>
                  {done.po_status === "received" ? (shortLeft > 0 ? "closed short" : "Received") : "Partly received"}
                  {done.po_status === "partially_received" && shortLeft > 0 ? ` · ${shortLeft} on backorder` : ""}
                </b>
              </>
            )}
          </p>
          <div className="rcv-v2-done-tiles">
            {order && (
              <div>
                <span>Expected</span>
                <strong>{totals.expected}</strong>
              </div>
            )}
            <div className="is-good">
              <span>Into stock</span>
              <strong>{done.good}</strong>
            </div>
            {order && (
              <div className={totals.short > 0 ? "is-short" : ""}>
                <span>Short</span>
                <strong>{totals.short}</strong>
              </div>
            )}
            <div className={done.damaged > 0 ? "is-damaged" : ""}>
              <span>Damaged</span>
              <strong>{Number(done.damaged)}</strong>
            </div>
          </div>
        </section>

        {differences.length > 0 && (supplier || order) && (
          <section className="rcv-v2-diff motion-enter" style={{ animationDelay: "120ms" }}>
            <div>
              <strong>Tell {supplier?.name || order?.supplier_name_snapshot || "the supplier"} about the difference</strong>
              <span>
                {differences.join(" · ")}. A message with the details is ready to send.
              </span>
            </div>
            <button type="button" disabled={!whatsappDigits(supplierPhone)} title={whatsappDigits(supplierPhone) ? "" : "Add the supplier's phone first"} onClick={sendDifference} className={`${buttonClassName({ variant: "secondary" })} po-v2-whatsapp`}>
              Send on WhatsApp
            </button>
          </section>
        )}

        <div className="rcv-v2-done-actions motion-enter" style={{ animationDelay: "180ms" }}>
          <button type="button" onClick={() => void printReceipt()} className={buttonClassName({ variant: "secondary" })}>
            Print receipt (GRN)
          </button>
          {itemIds.length > 0 && (
            <Link href={`/dashboard/qr-center?items=${itemIds.join(",")}`} className={buttonClassName({ variant: "secondary" })}>
              Print {done.good} shelf {done.good === 1 ? "label" : "labels"}
            </Link>
          )}
          {order && (
            <Link href={`/dashboard/purchase-orders/${order.id}`} className={buttonClassName({ variant: "secondary" })}>
              Open purchase order
            </Link>
          )}
          <Link href="/dashboard/receiving" className={buttonClassName()}>
            Receive another delivery
          </Link>
        </div>
      </DashboardPageShell>
    );
  }

  const chipFor = (line: CountLine) => {
    const received = n(line.received);
    if (line.received.trim() === "") return { label: "Not counted", tone: "idle" };
    if (blind || line.expected === null) return { label: received > 0 ? "Counted" : "Not counted", tone: received > 0 ? "info" : "idle" };
    if (received === line.expected) return { label: "Matches", tone: "ok" };
    if (received < line.expected) return { label: `${line.expected - received} short`, tone: "short" };
    return { label: `${received - line.expected} over`, tone: "over" };
  };

  const title = order ? "Receiving" : source === "return" ? "Customer return" : "Stock in without an order";

  return (
    <DashboardPageShell as="main" className="rcv-v2">
      <Link href="/dashboard/receiving" className="po-v2-back">
        ← Stock in
      </Link>
      <header className="rcv-v2-head motion-enter">
        <div className="rcv-v2-head-text">
          <h1>{title}</h1>
          <span className="pon-v2-number is-mono">{nextReference}</span>
          {order && (
            <span className="rcv-v2-for">
              for{" "}
              <Link href={`/dashboard/purchase-orders/${order.id}`} className="po-v2-link is-mono">
                {order.po_number}
              </Link>
              {order.supplier_name_snapshot ? ` · ${order.supplier_name_snapshot}` : ""} · into {depotName}
            </span>
          )}
        </div>
        <div className="rcv-v2-head-actions">
          {order && (
            <button type="button" aria-pressed={blind} onClick={() => setBlind((value) => !value)} className={buttonClassName({ variant: "secondary" })}>
              Blind count {blind ? "on" : "off"}
            </button>
          )}
          <button type="button" onClick={() => setScannerOpen(true)} className={buttonClassName({ variant: "secondary" })}>
            <UiIcon name="scan" className="h-4 w-4" />
            Scan items
          </button>
        </div>
      </header>

      <section className="po-v2-card rcv-v2-info motion-enter" style={{ animationDelay: "50ms" }}>
        {!order && (
          <>
            {source === "no_order" && (
              <label>
                Reason <span className="rcv-v2-required">*</span>
                <Select ariaLabel="Reason" value={reason} onChange={setReason} placeholder="Why is it coming in?" options={NO_ORDER_REASONS.map((entry) => ({ value: entry.value, label: entry.label }))} />
              </label>
            )}
            <label>
              {source === "return" ? "From customer / note" : "Supplier (optional)"}
              {source === "return" ? (
                <input value={deliveryNoteNo} onChange={(event) => setDeliveryNoteNo(event.target.value)} placeholder="e.g. Return from order #12" className="ui-input" />
              ) : (
                <Select ariaLabel="Supplier" value={supplierId} onChange={setSupplierId} placeholder="No supplier" searchable options={[{ value: "", label: "No supplier" }, ...suppliers.map((entry) => ({ value: String(entry.id), label: entry.name }))]} />
              )}
            </label>
            <label>
              Into depot
              <Select ariaLabel="Depot" value={depotId} onChange={setDepotId} options={[{ value: "", label: "Item's own depot" }, ...depots.map((entry) => ({ value: String(entry.id), label: formatDepotLabel(entry) }))]} />
            </label>
          </>
        )}
        {(order || source === "no_order") && (
          <label>
            Supplier delivery note #
            <input value={order || source === "no_order" ? deliveryNoteNo : ""} onChange={(event) => setDeliveryNoteNo(event.target.value)} placeholder="e.g. BL-4471" className="ui-input" />
          </label>
        )}
        <label>
          Received on
          <input type="datetime-local" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} className="ui-input" />
        </label>
        <label>
          Received by
          <input value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} className="ui-input" />
        </label>
        <input ref={photoRef} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
        <button type="button" onClick={() => photoRef.current?.click()} className="rcv-v2-photo">
          {photo ? `✓ ${photo.name.slice(0, 24)}` : "+ Photo of delivery note"}
        </button>
      </section>

      <div className="rcv-v2-grid">
        <section className="po-v2-card rcv-v2-count motion-enter" style={{ animationDelay: "100ms" }}>
          <div className="po-v2-card-head">
            <h2>Count what arrived</h2>
            {order && (
              <button type="button" onClick={() => setLines((current) => current.map((line) => ({ ...line, received: String(line.expected ?? 0) })))} className={buttonClassName({ variant: "secondary" })}>
                Everything arrived as ordered
              </button>
            )}
          </div>

          {!order && (
            <div className="rcv-v2-add">
              <label className="pon-v2-search">
                <UiIcon name="search" className="h-4 w-4" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (results[0]) addItemLine(results[0]);
                    else if (query.trim()) void handleCode(query);
                  }
                }} placeholder="Add item — type name or code, or scan a barcode" aria-label="Add item" />
                {results.length > 0 && query.trim() && (
                  <ul className="pon-v2-results">
                    {results.map((item) => (
                      <li key={item.id}>
                        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addItemLine(item)}>
                          <span className="po-v2-thumb">{item.image ? <ProductThumbnail src={item.image} alt="" sizes="36px" imgClassName="object-cover" iconClassName="h-4 w-4" fallbackClassName="flex h-full w-full items-center justify-center" /> : item.name.charAt(0).toUpperCase()}</span>
                          <span className="pon-v2-result-text">
                            <strong>{item.name}</strong>
                            <small>
                              <span className="is-mono">{item.item_code || item.sku || ""}</span> · {item.quantity} in stock
                            </small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </label>
            </div>
          )}

          {lines.length === 0 ? (
            <p className="po-v2-empty rcv-v2-empty">{order ? "Everything on this order has already arrived." : "Search, type a code or scan to add what came in."}</p>
          ) : (
            <ul className="rcv-v2-lines">
              {lines.map((line, index) => {
                const chip = chipFor(line);
                const priceChanged = line.poUnitCost !== null && line.unitCost.trim() !== "" && n(line.unitCost) !== line.poUnitCost;
                return (
                  <li key={line.key} className={index < 10 ? "motion-enter" : ""} style={index < 10 ? { animationDelay: `${150 + index * 50}ms` } : undefined}>
                    <div className="rcv-v2-line-top">
                      <span className="po-v2-thumb rcv-v2-thumb">
                        {line.image ? <ProductThumbnail src={line.image} alt="" sizes="48px" imgClassName="object-cover" iconClassName="h-5 w-5" fallbackClassName="flex h-full w-full items-center justify-center" /> : line.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="rcv-v2-line-name">
                        <strong>{line.name}</strong>
                        <small>
                          <span className="is-mono">{line.code}</span>
                          {line.code ? " · " : ""}
                          {line.unit}
                          {line.nowInStock !== null ? ` · now ${line.nowInStock} in stock` : ""}
                          {!line.affectsStock ? " · not stock" : ""}
                        </small>
                      </span>
                      {line.expected !== null && !blind && (
                        <span className="rcv-v2-expected">
                          <small>Expected</small>
                          <b className="is-mono">{line.expected}</b>
                        </span>
                      )}
                      <span className="rcv-v2-received">
                        <small>Received</small>
                        <span className={`alerts-v2-stepper rcv-v2-stepper ${bumped === line.key ? "is-bump" : ""}`}>
                          <button type="button" onClick={() => { updateLine(line.key, { received: String(Math.max(0, n(line.received) - 1)) }); bump(line.key); }} aria-label={`One less ${line.name}`}>
                            −
                          </button>
                          <input value={line.received} onChange={(event) => updateLine(line.key, { received: event.target.value.replace(/[^\d.]/g, "") })} inputMode="numeric" placeholder="0" aria-label={`Received ${line.name}`} />
                          <button type="button" onClick={() => { updateLine(line.key, { received: String(n(line.received) + 1) }); bump(line.key); }} aria-label={`One more ${line.name}`}>
                            +
                          </button>
                        </span>
                      </span>
                      <span className={`rcv-v2-chip is-${chip.tone}`}>{chip.label}</span>
                      {!order && (
                        <button type="button" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))} className="scanner-v2-line-remove" aria-label={`Remove ${line.name}`}>
                          <UiIcon name="close" className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="rcv-v2-line-more">
                      <label>
                        {source === "return" ? "Damaged (not restocked)" : "Damaged"}
                        <input value={line.damaged} onChange={(event) => updateLine(line.key, { damaged: event.target.value.replace(/[^\d.]/g, "") })} inputMode="numeric" placeholder="0" className={`ui-input is-small ${n(line.damaged) > 0 ? "is-damaged" : ""}`} />
                      </label>
                      {source !== "return" && (
                        <label>
                          Unit cost
                          <span className="pon-v2-money">
                            <span>{currency === "USD" ? "$" : currency}</span>
                            <input value={line.unitCost} onChange={(event) => updateLine(line.key, { unitCost: event.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="0.00" aria-label={`Unit cost of ${line.name}`} />
                          </span>
                          {priceChanged && <small className="rcv-v2-warn">PO price was {money(line.poUnitCost as number)}</small>}
                        </label>
                      )}
                      <label>
                        Expiry / batch
                        <span className="rcv-v2-batch">
                          <input type="date" value={line.expiry} onChange={(event) => updateLine(line.key, { expiry: event.target.value })} aria-label={`Expiry of ${line.name}`} className="ui-input is-small" />
                          <input value={line.batch} onChange={(event) => updateLine(line.key, { batch: event.target.value })} placeholder="batch (optional)" aria-label={`Batch of ${line.name}`} className="ui-input is-small" />
                        </span>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="rcv-v2-side">
          <section className="po-v2-card rcv-v2-summary motion-enter" style={{ animationDelay: "150ms" }}>
            <div className="rcv-v2-summary-head">
              <h2>This delivery</h2>
              {order && <span>{blind ? "—" : `${totals.percent}%`}</span>}
            </div>
            {order && (
              <span className="po-v2-bar" aria-hidden>
                <i style={{ transform: `scaleX(${blind ? 0 : totals.percent / 100})` }} />
              </span>
            )}
            <div className="rcv-v2-tiles">
              {order && (
                <div>
                  <span>Expected</span>
                  <strong>{blind ? "—" : totals.expected}</strong>
                </div>
              )}
              <div className="is-counted">
                <span>Counted</span>
                <strong>{totals.counted}</strong>
              </div>
              {order && (
                <div className={!blind && totals.short > 0 ? "is-short" : ""}>
                  <span>Short</span>
                  <strong>{blind ? "—" : totals.short}</strong>
                </div>
              )}
              <div className={totals.damaged > 0 ? "is-damaged" : ""}>
                <span>Damaged</span>
                <strong>{totals.damaged}</strong>
              </div>
            </div>
            <p className="rcv-v2-goes">
              Goes into stock{" "}
              <b className="is-mono">
                {totals.intoStock} units{totals.value > 0 ? ` · ${money(totals.value)}` : ""}
              </b>
            </p>
          </section>

          {order && !blind && totals.short > 0 && (
            <section className="rcv-v2-short">
              <h3>{totals.short} {totals.short === 1 ? "unit" : "units"} missing — what now?</h3>
              {(
                [
                  ["backorder", "Keep as backorder", "PO stays open for the missing units"],
                  ["close_short", "Close the order short", "Supplier won't send the rest"],
                ] as const
              ).map(([value, name, hint]) => (
                <label key={value} className={`rcv-v2-radio ${shortAction === value ? "is-active" : ""}`}>
                  <input type="radio" name="short-action" checked={shortAction === value} onChange={() => setShortAction(value)} />
                  <span>
                    <strong>{name}</strong>
                    <small>{hint}</small>
                  </span>
                </label>
              ))}
            </section>
          )}
        </aside>
      </div>

      <div className="pon-v2-bar rcv-v2-bar">
        <span className="pon-v2-bar-text">
          <small>
            {totals.intoStock} {totals.intoStock === 1 ? "unit goes" : "units go"} into {depotName}
            {order && totals.short > 0 ? ` · ${totals.short} short (${shortAction === "backorder" ? "backorder" : "close short"})` : ""}
            {totals.damaged > 0 ? ` · ${totals.damaged} damaged logged` : ""}
            {source === "no_order" && reason ? ` · ${reasonLabel(reason)}` : ""}
          </small>
        </span>
        {formError && (
          <span className="pon-v2-bar-error" role="alert">
            {formError}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            showToast({ tone: "success", message: "Saved on this computer. Come back any time to finish." });
            router.push("/dashboard/receiving");
          }}
          disabled={!hasCounts}
          className="pon-v2-text"
        >
          Save &amp; finish later
        </button>
        <button type="button" disabled={saving || (!hasCounts && !(order && shortAction === "close_short"))} onClick={() => void confirm()} className={buttonClassName()}>
          {saving ? "Saving…" : `Confirm receipt · add ${totals.intoStock} to stock`}
        </button>
      </div>

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDecode={(text) => void handleCode(text)}
        eyebrow="Stock in"
        title="Scan what arrived"
        description="Each scan adds one to the matching line."
      />
      <UnsavedChangesGuard when={hasCounts && !saving && !done} what="this delivery count" />
    </DashboardPageShell>
  );
}

export default function ReceivingNewPage() {
  return (
    <Suspense fallback={null}>
      <Receiving />
    </Suspense>
  );
}
