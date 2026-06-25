"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ContextBackButton from "@/components/navigation/ContextBackButton";
import {
  addPickListItem,
  cancelPickList,
  completePickList,
  getPickListDetail,
  getPickListErrorMessage,
  getPickListInventoryItems,
  getPickListProgress,
  removePickListItem,
  startPreparingPickList,
  updatePickList,
  updatePickListItem,
  type PickListDetail,
  type PickListInput,
  type PickListInventoryItem,
  type PickListItem,
  type PickListStatus,
} from "@/app/lib/pickLists";
import {
  getCategoriesForUser,
  type Category,
} from "@/app/lib/categories";
import {
  getInventoryQuantityLabel,
  getInventoryUnitLabel,
} from "@/app/lib/inventoryItemModel";
import {
  getSuppliersForUser,
  type Supplier,
} from "@/app/lib/suppliers";
import { supabase } from "@/app/lib/supabase";

interface LineDraft {
  required: string;
  prepared: string;
  notes: string;
}

const inputClassName =
  "w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-4 py-3.5 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-cyan-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(34,211,238,0.1)] disabled:cursor-not-allowed disabled:opacity-60";

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

function createLineDrafts(items: PickListItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        required: String(item.required_quantity),
        prepared: String(item.prepared_quantity),
        notes: item.notes || "",
      },
    ])
  ) as Record<number, LineDraft>;
}

function ModalCloseButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-theme bg-theme-surface text-xl text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary disabled:opacity-50"
    >
      X
    </button>
  );
}

export default function PickListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params.id;
  const pickListId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const validPickListId = Number.isInteger(pickListId) && pickListId > 0;

  const [detail, setDetail] = useState<PickListDetail | null>(null);
  const [inventoryItems, setInventoryItems] = useState<
    PickListInventoryItem[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [userId, setUserId] = useState("");
  const [lineDrafts, setLineDrafts] = useState<Record<number, LineDraft>>({});
  const [loading, setLoading] = useState(validPickListId);
  const [pageError, setPageError] = useState(
    validPickListId ? "" : "Pick List not found."
  );
  const [pageNotice, setPageNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [savingLineId, setSavingLineId] = useState<number | null>(null);

  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadataValues, setMetadataValues] = useState<PickListInput>({
    title: "",
    customer_name: "",
    due_date: "",
    notes: "",
  });
  const [metadataError, setMetadataError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(
    null
  );
  const [addQuantity, setAddQuantity] = useState("1");
  const [addNotes, setAddNotes] = useState("");
  const [addError, setAddError] = useState("");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [pendingRemove, setPendingRemove] = useState<PickListItem | null>(null);

  const refreshWorkspace = async (knownUserId: string) => {
    const [loadedDetail, loadedInventory] = await Promise.all([
      getPickListDetail(knownUserId, pickListId),
      getPickListInventoryItems(knownUserId),
    ]);

    setDetail(loadedDetail);
    setInventoryItems(loadedInventory);
    setLineDrafts(createLineDrafts(loadedDetail?.items || []));
  };

  useEffect(() => {
    let isActive = true;

    if (!validPickListId) return;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setPageError("Please sign in again to view this Pick List.");
          setLoading(false);
          return;
        }

        setUserId(user.id);

        try {
          const [
            loadedDetail,
            loadedInventory,
            loadedCategories,
            loadedSuppliers,
          ] = await Promise.all([
            getPickListDetail(user.id, pickListId),
            getPickListInventoryItems(user.id),
            getCategoriesForUser(user.id).catch(() => []),
            getSuppliersForUser(user.id).catch(() => []),
          ]);

          if (!isActive) return;

          setDetail(loadedDetail);
          setInventoryItems(loadedInventory);
          setCategories(loadedCategories);
          setSuppliers(loadedSuppliers);
          setLineDrafts(createLineDrafts(loadedDetail?.items || []));
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
  }, [pickListId, validPickListId]);

  const editable =
    detail?.status === "draft" || detail?.status === "preparing";
  const progress = getPickListProgress(detail?.items || []);
  const allPrepared =
    Boolean(detail?.items.length) &&
    detail?.items.every(
      (item) => item.prepared_quantity === item.required_quantity
    );
  const shortages = (detail?.items || []).filter(
    (item) =>
      !item.inventory ||
      item.inventory.quantity < item.required_quantity
  );

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const supplierNames = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers]
  );
  const linkedInventoryIds = useMemo(
    () =>
      new Set(
        (detail?.items || [])
          .map((item) => item.inventory_item_id)
          .filter((id): id is number => id !== null)
      ),
    [detail?.items]
  );

  const visibleInventoryItems = useMemo(() => {
    const normalizedSearch = itemSearch.trim().toLowerCase();

    return inventoryItems.filter((item) => {
      if (linkedInventoryIds.has(item.id)) return false;
      if (!normalizedSearch) return true;

      return [
        item.name,
        item.item_code,
        item.sku,
        item.barcode,
        item.category_id ? categoryNames.get(item.category_id) : "",
        item.supplier_id ? supplierNames.get(item.supplier_id) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [
    categoryNames,
    inventoryItems,
    itemSearch,
    linkedInventoryIds,
    supplierNames,
  ]);

  const selectedInventory =
    inventoryItems.find((item) => item.id === selectedInventoryId) || null;

  const replaceLine = (updatedLine: PickListItem) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === updatedLine.id ? updatedLine : item
            ),
          }
        : current
    );
    setLineDrafts((current) => ({
      ...current,
      [updatedLine.id]: {
        required: String(updatedLine.required_quantity),
        prepared: String(updatedLine.prepared_quantity),
        notes: updatedLine.notes || "",
      },
    }));
  };

  const openMetadata = () => {
    if (!detail || !editable) return;
    setMetadataValues({
      title: detail.title,
      customer_name: detail.customer_name || "",
      due_date: detail.due_date || "",
      notes: detail.notes || "",
    });
    setMetadataError("");
    setMetadataOpen(true);
  };

  const handleMetadataSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !userId || busyAction || !metadataValues.title.trim()) {
      return;
    }

    try {
      setBusyAction("metadata");
      setMetadataError("");
      const updated = await updatePickList(
        userId,
        detail.id,
        metadataValues
      );
      setDetail((current) => (current ? { ...current, ...updated } : current));
      setMetadataOpen(false);
      setPageNotice("Pick List details updated.");
    } catch (error) {
      setMetadataError(getPickListErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  const handleStartPreparing = async () => {
    if (!detail || !userId || busyAction) return;

    try {
      setBusyAction("start");
      setPageError("");
      const updated = await startPreparingPickList(userId, detail.id);
      setDetail((current) => (current ? { ...current, ...updated } : current));
      setPageNotice("Preparation started. Stock has not been deducted.");
    } catch (error) {
      setPageError(getPickListErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  const handleCancel = async () => {
    if (!detail || !userId || busyAction) return;

    try {
      setBusyAction("cancel");
      setPageError("");
      const updated = await cancelPickList(userId, detail.id);
      setDetail((current) => (current ? { ...current, ...updated } : current));
      setCancelOpen(false);
      setPageNotice("Pick List cancelled. Inventory was not changed.");
    } catch (error) {
      setPageError(getPickListErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  const openAddItem = () => {
    setItemSearch("");
    setSelectedInventoryId(null);
    setAddQuantity("1");
    setAddNotes("");
    setAddError("");
    setAddOpen(true);
  };

  const handleAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !userId || !selectedInventory || busyAction) return;

    const requiredQuantity = Number(addQuantity);

    if (
      !Number.isInteger(requiredQuantity) ||
      requiredQuantity <= 0
    ) {
      setAddError("Required quantity must be a whole number above zero.");
      return;
    }

    try {
      setBusyAction("add-item");
      setAddError("");
      await addPickListItem(userId, detail.id, {
        inventoryItemId: selectedInventory.id,
        requiredQuantity,
        notes: addNotes,
      });
      await refreshWorkspace(userId);
      setAddOpen(false);
      setPageNotice(`${selectedInventory.name} added to the Pick List.`);
    } catch (error) {
      setAddError(getPickListErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  const updateLineDraft = (
    itemId: number,
    field: keyof LineDraft,
    value: string
  ) => {
    setLineDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || {
          required: "",
          prepared: "",
          notes: "",
        }),
        [field]: value,
      },
    }));
  };

  const saveLine = async (
    item: PickListItem,
    override?: Partial<{
      requiredQuantity: number;
      preparedQuantity: number;
      notes: string;
    }>
  ) => {
    if (savingLineId || !editable) return;

    const draft = lineDrafts[item.id] || {
      required: String(item.required_quantity),
      prepared: String(item.prepared_quantity),
      notes: item.notes || "",
    };
    const requiredQuantity =
      override?.requiredQuantity ?? Number(draft.required);
    const preparedQuantity =
      override?.preparedQuantity ?? Number(draft.prepared);
    const notes = override?.notes ?? draft.notes;

    try {
      setSavingLineId(item.id);
      setPageError("");
      const updated = await updatePickListItem(item.id, {
        requiredQuantity,
        preparedQuantity,
        notes,
      });
      replaceLine(updated);
      setPageNotice(`${updated.item_name_snapshot} updated.`);
    } catch (error) {
      setPageError(getPickListErrorMessage(error));
    } finally {
      setSavingLineId(null);
    }
  };

  const handleRemove = async () => {
    if (!pendingRemove || busyAction) return;

    try {
      setBusyAction("remove");
      setPageError("");
      await removePickListItem(pendingRemove.id);
      setDetail((current) =>
        current
          ? {
              ...current,
              items: current.items.filter(
                (item) => item.id !== pendingRemove.id
              ),
            }
          : current
      );
      setLineDrafts((current) => {
        const next = { ...current };
        delete next[pendingRemove.id];
        return next;
      });
      setPageNotice(`${pendingRemove.item_name_snapshot} removed.`);
      setPendingRemove(null);
    } catch (error) {
      setPageError(getPickListErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  };

  const openCompletion = () => {
    setCompletionError("");
    setCompleteOpen(true);
  };

  const handleComplete = async () => {
    if (!detail || busyAction) return;

    if (!allPrepared) {
      setCompletionError(
        "Every item must be fully prepared before completion."
      );
      return;
    }

    try {
      setBusyAction("complete");
      setCompletionError("");
      setPageError("");
      await completePickList(detail.id, false);
      await refreshWorkspace(userId);
      setCompleteOpen(false);
      setPageNotice("Pick List completed without changing stock.");
    } catch (error) {
      setCompletionError(getPickListErrorMessage(error));
      await refreshWorkspace(userId).catch(() => undefined);
    } finally {
      setBusyAction("");
    }
  };

  const pickedItems = (detail?.items || []).filter(
    (item) => item.prepared_quantity > 0 && item.inventory_item_id
  );

  const openQrCenterForPickedItems = () => {
    const ids = pickedItems
      .map((item) => item.inventory_item_id)
      .filter((id): id is number => Boolean(id));
    if (ids.length === 0) {
      setPageError("Prepare at least one linked item before creating QR labels.");
      return;
    }
    const params = new URLSearchParams({ items: ids.join(",") });
    router.push(`/dashboard/qr-center?${params.toString()}`);
  };

  const exportPickListCsv = () => {
    if (!detail) return;

    const headers = [
      "Picked",
      "Item",
      "Code/SKU",
      "Available Quantity",
      "Required Quantity",
      "Prepared Quantity",
      "Unit",
      "Status",
      "Notes",
    ];
    const rows = detail.items.map((item) => {
      const available = item.inventory?.quantity ?? 0;
      const shortage = available < item.required_quantity;
      const status =
        available <= 0
          ? "No stock"
          : shortage
            ? "Not enough"
            : item.prepared_quantity > 0
              ? "Ready"
              : "Not picked";

      return [
        "",
        item.item_name_snapshot,
        item.item_code_snapshot || item.sku_snapshot || "",
        available,
        item.required_quantity,
        item.prepared_quantity,
        item.unit_label_snapshot || "",
        status,
        item.notes || "",
      ];
    });
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return /[",\r\n]/.test(text)
              ? `"${text.replace(/"/g, '""')}"`
              : text;
          })
          .join(",")
      )
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${detail.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "pick-list"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setPageNotice("Pick sheet CSV exported. Inventory was not changed.");
  };

  if (loading) {
    return (
      <div className="contents">
        <main className="operations-workspace operations-pick-list-detail">
          <div className="mx-auto max-w-[1400px] space-y-6">
            <div className="glass-panel h-64 animate-pulse" />
            <div className="glass-card h-40 animate-pulse" />
            <div className="glass-card h-72 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="contents">
        <main className="operations-workspace operations-pick-list-detail">
          <section className="glass-panel mx-auto max-w-2xl p-7 text-center">
            <h1 className="text-3xl font-black">Pick List unavailable</h1>
            <p className="mt-3 leading-7 text-theme-muted">
              {pageError ||
                "This Pick List does not exist or you do not have access to it."}
            </p>
            <Link
              href="/dashboard/pick-lists"
              className="glass-button mt-6 px-6 py-3.5 font-bold"
            >
              Back to Pick Lists
            </Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="contents">
      <main className="operations-workspace operations-pick-list-detail">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-7">
          <section className="glass-panel p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <ContextBackButton
                  fallbackHref="/dashboard/pick-lists"
                  label="Back to Pick Lists"
                  className="mb-4"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard/pick-lists"
                    className="text-sm font-bold text-theme-accent transition hover:text-theme-primary"
                  >
                    Pick Lists
                  </Link>
                  <span className="text-theme-subtle">/</span>
                  <span
                    className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusClasses[detail.status]}`}
                  >
                    {statusLabels[detail.status]}
                  </span>
                </div>

                <h1 className="mt-4 break-words text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  {detail.title}
                </h1>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-theme-muted">
                  <span>{detail.customer_name || "No customer name"}</span>
                  <span>{formatDate(detail.due_date)}</span>
                  <span>{detail.items.length} items</span>
                </div>
                {detail.notes && (
                  <p className="mt-5 max-w-3xl whitespace-pre-wrap leading-7 text-theme-secondary">
                    {detail.notes}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:max-w-xl xl:justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 font-bold transition hover:bg-theme-hover"
                >
                  Print Pick Sheet
                </button>
                <button
                  type="button"
                  onClick={exportPickListCsv}
                  className="rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 font-bold transition hover:bg-theme-hover"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={openQrCenterForPickedItems}
                  disabled={pickedItems.length === 0}
                  className="rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 font-bold transition hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  QR Labels
                </button>
                {editable && (
                  <>
                    <button
                      type="button"
                      onClick={openMetadata}
                      disabled={Boolean(busyAction)}
                      className="rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 font-bold transition hover:bg-theme-hover disabled:opacity-50"
                    >
                      Edit Details
                    </button>
                    <button
                      type="button"
                      onClick={openAddItem}
                      disabled={Boolean(busyAction)}
                      className="glass-button px-5 py-3.5 font-bold disabled:opacity-50"
                    >
                      Add Item
                    </button>
                    {detail.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => void handleStartPreparing()}
                        disabled={Boolean(busyAction)}
                        className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-3.5 font-bold text-theme-accent transition hover:bg-cyan-400/20 disabled:opacity-50"
                      >
                        {busyAction === "start"
                          ? "Starting..."
                          : "Start Preparing"}
                      </button>
                    )}
                    {detail.status === "preparing" && (
                      <button
                        type="button"
                        onClick={openCompletion}
                        disabled={Boolean(busyAction)}
                        className="rounded-2xl border border-emerald-300/30 bg-emerald-400/15 px-5 py-3.5 font-bold text-theme-success transition hover:bg-emerald-400/25 disabled:opacity-50"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCancelOpen(true)}
                      disabled={Boolean(busyAction)}
                      className="rounded-2xl border border-red-300/20 bg-red-400/10 px-5 py-3.5 font-bold text-theme-danger transition hover:bg-red-400/20 disabled:opacity-50"
                    >
                      Cancel List
                    </button>
                  </>
                )}
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

          {!editable && (
            <section
              className={`rounded-[28px] border p-5 sm:p-6 ${
                detail.status === "completed"
                  ? "border-emerald-300/20 bg-emerald-400/[0.08]"
                  : "border-red-300/15 bg-red-400/[0.06]"
              }`}
            >
              <h2 className="text-xl font-black">
                This Pick List is read-only
              </h2>
              <p className="mt-2 leading-7 text-theme-muted">
                {detail.status === "completed"
                  ? detail.completion_stock_action === "deducted"
                    ? "It was completed and inventory stock was deducted atomically."
                    : "It was completed without changing inventory stock."
                  : "It was cancelled without changing inventory stock."}
              </p>
            </section>
          )}

          <section className="glass-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
                  Preparation progress
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {progress.prepared} / {progress.required} prepared
                </h2>
              </div>
              <span className="text-3xl font-black text-theme-accent">
                {progress.percent}%
              </span>
            </div>
            <div
              className="mt-5 h-3 overflow-hidden rounded-full bg-theme-surface"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-500 to-indigo-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-theme-subtle">
              Draft and preparing quantities do not reserve or deduct stock.
            </p>
          </section>

          {detail.items.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
                    Line items
                  </p>
                  <h2 className="mt-2 text-3xl font-black">Preparation Items</h2>
                </div>
                {editable && (
                  <button
                    type="button"
                    onClick={openAddItem}
                    className="rounded-xl border border-theme bg-theme-surface px-4 py-3 text-sm font-bold transition hover:bg-theme-hover"
                  >
                    Add Item
                  </button>
                )}
              </div>

              {detail.items.map((item) => {
                const draft = lineDrafts[item.id] || {
                  required: String(item.required_quantity),
                  prepared: String(item.prepared_quantity),
                  notes: item.notes || "",
                };
                const currentStock = item.inventory?.quantity;
                const hasShortage =
                  !item.inventory ||
                  Number(currentStock) < item.required_quantity;

                return (
                  <article
                    key={item.id}
                    className="glass-card overflow-hidden p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-2xl font-black">
                            {item.item_name_snapshot}
                          </h3>
                          {hasShortage && editable && (
                            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-theme-warning">
                              {item.inventory
                                ? "Insufficient stock"
                                : "Inventory link missing"}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          {item.item_code_snapshot && (
                            <span className="rounded-full border border-theme bg-theme-surface px-3 py-1.5 text-theme-secondary">
                              Code {item.item_code_snapshot}
                            </span>
                          )}
                          {item.sku_snapshot && (
                            <span className="rounded-full border border-theme bg-theme-surface px-3 py-1.5 text-theme-secondary">
                              SKU {item.sku_snapshot}
                            </span>
                          )}
                          <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.08] px-3 py-1.5 text-theme-accent">
                            {item.unit_label_snapshot || "Unit"}
                          </span>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-theme-muted">
                          Current stock:{" "}
                          <span
                            className={
                              hasShortage ? "text-theme-warning" : "text-theme-primary"
                            }
                          >
                            {item.inventory
                              ? getInventoryQuantityLabel(
                                  item.inventory.quantity,
                                  item.inventory.unit_type,
                                  item.inventory.custom_unit_label
                                )
                              : "Unavailable"}
                          </span>
                        </p>
                      </div>

                      {!editable && (
                        <div className="grid min-w-full grid-cols-2 gap-3 sm:min-w-[320px]">
                          <div className="rounded-2xl border border-theme bg-theme-inset p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Required
                            </p>
                            <p className="mt-2 text-2xl font-black">
                              {item.required_quantity}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.08] p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-theme-subtle">
                              Prepared
                            </p>
                            <p className="mt-2 text-2xl font-black text-theme-success">
                              {item.prepared_quantity}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {editable && (
                      <div className="mt-6 grid gap-4 border-t border-theme pt-5 lg:grid-cols-[180px_1fr]">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-theme-muted">
                            Required quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={draft.required}
                            onChange={(event) =>
                              updateLineDraft(
                                item.id,
                                "required",
                                event.target.value
                              )
                            }
                            disabled={savingLineId === item.id}
                            className={inputClassName}
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-theme-muted">
                            Prepared quantity
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() =>
                                void saveLine(item, {
                                  preparedQuantity: Math.max(
                                    0,
                                    item.prepared_quantity - 1
                                  ),
                                })
                              }
                              disabled={
                                savingLineId === item.id ||
                                item.prepared_quantity <= 0
                              }
                              className="h-12 rounded-xl border border-theme bg-theme-surface px-4 text-xl font-black disabled:opacity-40"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draft.prepared}
                              onChange={(event) =>
                                updateLineDraft(
                                  item.id,
                                  "prepared",
                                  event.target.value
                                )
                              }
                              disabled={savingLineId === item.id}
                              className={`${inputClassName} sm:max-w-36`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void saveLine(item, {
                                  preparedQuantity: Math.min(
                                    item.required_quantity,
                                    item.prepared_quantity + 1
                                  ),
                                })
                              }
                              disabled={
                                savingLineId === item.id ||
                                item.prepared_quantity >= item.required_quantity
                              }
                              className="h-12 rounded-xl border border-theme bg-theme-surface px-4 text-xl font-black disabled:opacity-40"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void saveLine(item, {
                                  preparedQuantity: item.required_quantity,
                                })
                              }
                              disabled={
                                savingLineId === item.id ||
                                item.prepared_quantity === item.required_quantity
                              }
                              className="min-h-12 flex-1 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-theme-success disabled:opacity-40"
                            >
                              Mark Prepared
                            </button>
                          </div>
                        </div>

                        <div className="lg:col-span-2">
                          <label className="mb-2 block text-sm font-semibold text-theme-muted">
                            Line notes
                          </label>
                          <textarea
                            value={draft.notes}
                            onChange={(event) =>
                              updateLineDraft(
                                item.id,
                                "notes",
                                event.target.value
                              )
                            }
                            disabled={savingLineId === item.id}
                            placeholder="Optional preparation note"
                            className={`${inputClassName} min-h-24 resize-y`}
                          />
                        </div>

                        <div className="flex flex-col-reverse gap-3 sm:flex-row lg:col-span-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => setPendingRemove(item)}
                            disabled={savingLineId === item.id}
                            className="rounded-xl border border-red-300/20 bg-red-400/10 px-5 py-3 text-sm font-bold text-theme-danger disabled:opacity-50"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveLine(item)}
                            disabled={savingLineId === item.id}
                            className="glass-button px-5 py-3 text-sm font-bold disabled:opacity-50"
                          >
                            {savingLineId === item.id
                              ? "Saving..."
                              : "Save Line"}
                          </button>
                        </div>
                      </div>
                    )}

                    {!editable && item.notes && (
                      <p className="mt-5 whitespace-pre-wrap border-t border-theme pt-5 text-sm leading-6 text-theme-muted">
                        {item.notes}
                      </p>
                    )}
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="glass-card border-dashed px-5 py-16 text-center">
              <h2 className="text-3xl font-black">
                {editable ? "Add preparation items" : "No line items"}
              </h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-theme-muted">
                {editable
                  ? "Search your private inventory and add everything needed for this order, event, or project."
                  : "This Pick List was closed without any saved line items."}
              </p>
              {editable && (
                <button
                  type="button"
                  onClick={openAddItem}
                  className="glass-button mt-6 px-6 py-3.5 font-bold"
                >
                  Add First Item
                </button>
              )}
            </section>
          )}
        </div>
      </main>

      {metadataOpen && (
        <div className="operations-modal-overlay fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="glass-modal my-8 w-full max-w-2xl p-5 sm:p-7">
            <form onSubmit={handleMetadataSave}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
                    Pick List details
                  </p>
                  <h2 className="mt-2 text-3xl font-black">Edit Details</h2>
                </div>
                <ModalCloseButton
                  label="Close details form"
                  disabled={busyAction === "metadata"}
                  onClick={() => setMetadataOpen(false)}
                />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-theme-secondary">
                    Title
                  </label>
                  <input
                    value={metadataValues.title}
                    onChange={(event) =>
                      setMetadataValues((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    disabled={busyAction === "metadata"}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-theme-secondary">
                    Customer name
                  </label>
                  <input
                    value={metadataValues.customer_name || ""}
                    onChange={(event) =>
                      setMetadataValues((current) => ({
                        ...current,
                        customer_name: event.target.value,
                      }))
                    }
                    disabled={busyAction === "metadata"}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-theme-secondary">
                    Due / event date
                  </label>
                  <input
                    type="date"
                    value={metadataValues.due_date || ""}
                    onChange={(event) =>
                      setMetadataValues((current) => ({
                        ...current,
                        due_date: event.target.value,
                      }))
                    }
                    disabled={busyAction === "metadata"}
                    className={inputClassName}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-theme-secondary">
                    Notes
                  </label>
                  <textarea
                    value={metadataValues.notes || ""}
                    onChange={(event) =>
                      setMetadataValues((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    disabled={busyAction === "metadata"}
                    className={`${inputClassName} min-h-28 resize-y`}
                  />
                </div>
              </div>

              {metadataError && (
                <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                  {metadataError}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setMetadataOpen(false)}
                  disabled={busyAction === "metadata"}
                  className="rounded-2xl border border-theme bg-theme-surface px-6 py-3.5 font-bold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    busyAction === "metadata" ||
                    !metadataValues.title.trim()
                  }
                  className="glass-button px-6 py-3.5 font-bold disabled:opacity-50"
                >
                  {busyAction === "metadata" ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="operations-modal-overlay fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="glass-modal my-8 max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
                  Private inventory
                </p>
                <h2 className="mt-2 text-3xl font-black">Add Item</h2>
                <p className="mt-2 text-sm leading-6 text-theme-muted">
                  Search by name, code, SKU, barcode, category, or supplier.
                </p>
              </div>
              <ModalCloseButton
                label="Close add item form"
                disabled={busyAction === "add-item"}
                onClick={() => setAddOpen(false)}
              />
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-semibold text-theme-secondary">
                Search inventory
              </label>
              <input
                type="search"
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                placeholder="Name, code, SKU, barcode, category, supplier"
                className={inputClassName}
              />
            </div>

            <div className="mt-5 max-h-80 space-y-3 overflow-y-auto pr-1">
              {visibleInventoryItems.length > 0 ? (
                visibleInventoryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedInventoryId(item.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedInventoryId === item.id
                        ? "border-cyan-300/35 bg-cyan-400/12"
                        : "border-theme bg-theme-inset hover:bg-theme-hover"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black text-theme-primary">{item.name}</p>
                        <p className="mt-1 text-xs text-theme-subtle">
                          {[item.item_code, item.sku]
                            .filter(Boolean)
                            .join(" / ") || "No code or SKU"}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-theme-muted">
                          {item.category_id
                            ? categoryNames.get(item.category_id) ||
                              "Uncategorized"
                            : "Uncategorized"}
                          {" / "}
                          {item.supplier_id
                            ? supplierNames.get(item.supplier_id) ||
                              "No supplier"
                            : "No supplier"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-theme bg-theme-surface px-3 py-1.5 text-xs font-bold text-theme-primary">
                        {getInventoryQuantityLabel(
                          item.quantity,
                          item.unit_type,
                          item.custom_unit_label
                        )}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-theme px-5 py-10 text-center text-sm text-theme-subtle">
                  No available inventory items match this search.
                </div>
              )}
            </div>

            <form onSubmit={handleAddItem} className="mt-6 border-t border-theme pt-6">
              {selectedInventory ? (
                <>
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.08] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-theme-accent">
                      Selected item
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {selectedInventory.name}
                    </p>
                    <p className="mt-1 text-sm text-theme-muted">
                      Current stock:{" "}
                      {getInventoryQuantityLabel(
                        selectedInventory.quantity,
                        selectedInventory.unit_type,
                        selectedInventory.custom_unit_label
                      )}
                      {" / "}
                      Unit:{" "}
                      {getInventoryUnitLabel(
                        selectedInventory.unit_type,
                        selectedInventory.custom_unit_label
                      )}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-theme-secondary">
                        Required quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={addQuantity}
                        onChange={(event) => setAddQuantity(event.target.value)}
                        disabled={busyAction === "add-item"}
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-theme-secondary">
                        Line notes
                      </label>
                      <input
                        value={addNotes}
                        onChange={(event) => setAddNotes(event.target.value)}
                        disabled={busyAction === "add-item"}
                        placeholder="Optional"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm font-semibold text-theme-subtle">
                  Select an inventory item to continue.
                </p>
              )}

              {addError && (
                <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                  {addError}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  disabled={busyAction === "add-item"}
                  className="rounded-2xl border border-theme bg-theme-surface px-6 py-3.5 font-bold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    busyAction === "add-item" || !selectedInventory
                  }
                  className="glass-button px-6 py-3.5 font-bold disabled:opacity-50"
                >
                  {busyAction === "add-item" ? "Adding..." : "Add to Pick List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div className="operations-modal-overlay fixed inset-0 z-[80] flex items-center justify-center theme-overlay p-4 backdrop-blur-xl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-pick-list-title"
            className="glass-modal w-full max-w-md p-6 sm:p-7"
          >
            <p className="text-xs font-black uppercase tracking-[0.17em] text-red-300">
              Cancel Pick List
            </p>
            <h2 id="cancel-pick-list-title" className="mt-3 text-2xl font-black">
              Cancel {detail.title}?
            </h2>
            <p className="mt-3 leading-7 text-theme-muted">
              Stock will not change. The Pick List will become permanently
              read-only and cannot be reopened.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                disabled={busyAction === "cancel"}
                className="flex-1 rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 font-bold disabled:opacity-50"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={busyAction === "cancel"}
                className="flex-1 rounded-2xl border border-red-400/25 bg-red-500/20 px-5 py-3.5 font-bold text-theme-danger disabled:opacity-50"
              >
                {busyAction === "cancel" ? "Cancelling..." : "Cancel Pick List"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRemove && (
        <div className="operations-modal-overlay fixed inset-0 z-[80] flex items-center justify-center theme-overlay p-4 backdrop-blur-xl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-pick-list-item-title"
            className="glass-modal w-full max-w-md p-6 sm:p-7"
          >
            <p className="text-xs font-black uppercase tracking-[0.17em] text-red-300">
              Remove line item
            </p>
            <h2
              id="remove-pick-list-item-title"
              className="mt-3 break-words text-2xl font-black"
            >
              Remove {pendingRemove.item_name_snapshot}?
            </h2>
            <p className="mt-3 leading-7 text-theme-muted">
              This only removes the line from this Pick List. Inventory stock
              will not change.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setPendingRemove(null)}
                disabled={busyAction === "remove"}
                className="flex-1 rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 font-bold disabled:opacity-50"
              >
                Keep Item
              </button>
              <button
                type="button"
                onClick={() => void handleRemove()}
                disabled={busyAction === "remove"}
                className="flex-1 rounded-2xl border border-red-400/25 bg-red-500/20 px-5 py-3.5 font-bold text-theme-danger disabled:opacity-50"
              >
                {busyAction === "remove" ? "Removing..." : "Remove Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {completeOpen && (
        <div className="operations-modal-overlay fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-pick-list-title"
            className="glass-modal my-8 max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto p-5 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.17em] text-emerald-300">
                  Final review
                </p>
                <h2
                  id="complete-pick-list-title"
                  className="mt-2 text-3xl font-black"
                >
                  Complete Pick List
                </h2>
                <p className="mt-2 text-sm leading-6 text-theme-muted">
                  Completion is permanent. In this v1, completion marks
                  operational progress only and does not deduct inventory.
                </p>
              </div>
              <ModalCloseButton
                label="Close completion review"
                disabled={busyAction === "complete"}
                onClick={() => setCompleteOpen(false)}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-300/35 bg-cyan-400/12 p-4">
                <p className="font-black text-theme-primary">
                  Complete without deducting
                </p>
                <p className="mt-2 text-sm leading-6 text-theme-muted">
                  Close the Pick List as prepared while leaving inventory
                  quantities unchanged. Stock deduction after picking is a
                  future workflow and is intentionally unavailable here.
                </p>
            </div>

            <div className="mt-6 space-y-3">
              {detail.items.map((item) => {
                const shortage =
                  !item.inventory ||
                  item.inventory.quantity < item.required_quantity;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 ${
                      shortage
                        ? "border-amber-300/25 bg-amber-400/[0.08]"
                        : "border-theme bg-theme-inset"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black">{item.item_name_snapshot}</p>
                        <p className="mt-1 text-xs text-theme-subtle">
                          Required {item.required_quantity} / Prepared{" "}
                          {item.prepared_quantity}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-bold ${
                          shortage
                            ? "text-theme-warning"
                            : "text-theme-secondary"
                        }`}
                      >
                        {!item.inventory
                          ? "Inventory unavailable"
                          : `No stock change (${item.inventory.quantity} available)`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {!allPrepared && (
              <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-theme-warning">
                Every line must be fully prepared before completion.
              </div>
            )}

            {shortages.length > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-theme-warning">
                {shortages.length} line{shortages.length === 1 ? "" : "s"}{" "}
                has a current stock shortage. You can still complete this v1
                pick list because inventory quantities are not deducted.
              </div>
            )}

            {completionError && (
              <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                {completionError}
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setCompleteOpen(false)}
                disabled={busyAction === "complete"}
                className="flex-1 rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 font-bold disabled:opacity-50"
              >
                Continue Preparing
              </button>
              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={
                  busyAction === "complete" ||
                  !allPrepared
                }
                className="flex-1 rounded-2xl border border-emerald-300/30 bg-emerald-400/20 px-5 py-3.5 font-bold text-theme-success disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyAction === "complete"
                  ? "Completing..."
                  : "Complete Without Deducting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
