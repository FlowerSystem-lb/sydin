"use client";
import { neutralizeSpreadsheetFormula } from "@/app/lib/exportSafety";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ContextBackButton from "@/components/navigation/ContextBackButton";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardToolbar,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import {
  Button,
  DialogShell,
  FieldGroup,
  FieldRow,
  SearchInput,
} from "@/components/ui";
import UiIcon from "@/components/UiIcon";
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
import { getInventoryQuantityLabel } from "@/app/lib/inventoryItemModel";
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
  "w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-4 py-3.5 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-sydin-blue/50 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] disabled:cursor-not-allowed disabled:opacity-60";

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
            const text = String(neutralizeSpreadsheetFormula(value) ?? "");
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
          <DashboardPageShell>
            <LoadingSkeletonGroup count={3} itemClassName="min-h-40" />
          </DashboardPageShell>
        </main>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="contents">
        <main className="operations-workspace operations-pick-list-detail">
          <DashboardPageShell>
            <DashboardEmptyState
              icon="picklists"
              title="Pick List unavailable"
              description={
                pageError ||
                "This Pick List does not exist or you do not have access to it."
              }
              action={
                <ActionButton href="/dashboard/pick-lists">
                  Back to Pick Lists
                </ActionButton>
              }
            />
          </DashboardPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="contents">
      <main className="operations-workspace operations-pick-list-detail">
        <DashboardPageShell>
          <div className="flex flex-col gap-3">
            <ContextBackButton
              fallbackHref="/dashboard/pick-lists"
              label="Back to Pick Lists"
            />

            <DashboardPageHeader
              record
              eyebrow="Order preparation"
              title={detail.title}
              description={[
                detail.customer_name || "No customer name",
                formatDate(detail.due_date),
                `${detail.items.length} ${detail.items.length === 1 ? "item" : "items"}`,
              ].join("  ·  ")}
              actions={
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusClasses[detail.status]}`}
                >
                  {statusLabels[detail.status]}
                </span>
              }
            />
          </div>

          {detail.notes && (
            <section className="dashboard-card">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-theme-subtle">
                Notes
              </p>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-theme-secondary">
                {detail.notes}
              </p>
            </section>
          )}

          {/* Seven hand-styled buttons in five colours became the shared
              Button set: one primary (the next step for this status), the
              rest secondary, Cancel List on the danger surface. */}
          <DashboardToolbar className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              Print Pick Sheet
            </Button>
            <Button variant="secondary" onClick={exportPickListCsv}>
              Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={openQrCenterForPickedItems}
              disabled={pickedItems.length === 0}
            >
              QR Labels
            </Button>
            {editable && (
              <>
                <Button
                  variant="secondary"
                  onClick={openMetadata}
                  disabled={Boolean(busyAction)}
                >
                  Edit Details
                </Button>
                <Button
                  variant={detail.status === "preparing" ? "secondary" : "primary"}
                  onClick={openAddItem}
                  disabled={Boolean(busyAction)}
                  leadingIcon={<UiIcon name="plus" className="h-4 w-4" />}
                >
                  Add Item
                </Button>
                {detail.status === "draft" && (
                  <Button
                    variant="secondary"
                    onClick={() => void handleStartPreparing()}
                    disabled={Boolean(busyAction)}
                    loading={busyAction === "start"}
                    loadingLabel="Starting..."
                  >
                    Start Preparing
                  </Button>
                )}
                {detail.status === "preparing" && (
                  <Button onClick={openCompletion} disabled={Boolean(busyAction)}>
                    Complete
                  </Button>
                )}
                <Button
                  variant="danger"
                  className="ml-auto"
                  onClick={() => setCancelOpen(true)}
                  disabled={Boolean(busyAction)}
                >
                  Cancel List
                </Button>
              </>
            )}
          </DashboardToolbar>

          {(pageError || pageNotice) && (
            <DashboardNotice tone={pageError ? "danger" : "success"}>
              {pageError || pageNotice}
            </DashboardNotice>
          )}

          {!editable && (
            <DashboardNotice
              tone={detail.status === "completed" ? "success" : "info"}
            >
              <strong>This Pick List is read-only.</strong>{" "}
              {detail.status === "completed"
                ? detail.completion_stock_action === "deducted"
                  ? "It was completed and inventory stock was deducted."
                  : "It was completed without changing inventory stock."
                : "It was cancelled without changing inventory stock."}
            </DashboardNotice>
          )}

          <section className="dashboard-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.17em] text-theme-accent">
                  Preparation progress
                </p>
                <h2 className="mt-2 text-xl font-black">
                  {progress.prepared} / {progress.required} prepared
                </h2>
              </div>
              <span className="text-xl font-black text-theme-accent">
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
                className="h-full rounded-full bg-[linear-gradient(90deg,#10c4dc,#2563eb_58%,#7d5cff)]"
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
                  <h2 className="mt-2 text-xl font-black">Preparation Items</h2>
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
                    className="dashboard-card overflow-hidden"
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
                          <span className="rounded-full border border-sydin-blue/15 bg-sydin-blue/[0.08] px-3 py-1.5 text-theme-accent">
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
                            className={`${inputClassName} min-h-24 resize-none`}
                          />
                        </div>

                        <div className="flex flex-col-reverse gap-3 sm:flex-row lg:col-span-2 lg:justify-end">
                          <Button
                            variant="danger"
                            onClick={() => setPendingRemove(item)}
                            disabled={savingLineId === item.id}
                          >
                            Remove
                          </Button>
                          <Button
                            onClick={() => void saveLine(item)}
                            loading={savingLineId === item.id}
                            loadingLabel="Saving..."
                          >
                            Save Line
                          </Button>
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
            <DashboardEmptyState
              icon="picklists"
              title={editable ? "Add preparation items" : "No line items"}
              description={
                editable
                  ? "Search your inventory and add everything needed for this order, event, or project."
                  : "This Pick List was closed without any saved line items."
              }
              action={
                editable ? (
                  <ActionButton onClick={openAddItem} icon="plus">
                    Add First Item
                  </ActionButton>
                ) : undefined
              }
            />
          )}
        </DashboardPageShell>
      </main>

      {metadataOpen && (
        <DialogShell
          title="Edit Details"
          eyebrow="Pick List details"
          onClose={() => setMetadataOpen(false)}
          closeDisabled={busyAction === "metadata"}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setMetadataOpen(false)}
                disabled={busyAction === "metadata"}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="pick-list-details"
                disabled={!metadataValues.title.trim()}
                loading={busyAction === "metadata"}
                loadingLabel="Saving..."
              >
                Save Details
              </Button>
            </>
          }
        >
          <form
            id="pick-list-details"
            onSubmit={handleMetadataSave}
            className="item-form -mx-1"
          >
            {metadataError && (
              <div className="mx-5 mb-3">
                <DashboardNotice tone="danger">{metadataError}</DashboardNotice>
              </div>
            )}
            <FieldGroup label="Order">
              <FieldRow label="Title" htmlFor="pl-title" required>
                <input
                  id="pl-title"
                  value={metadataValues.title}
                  onChange={(event) =>
                    setMetadataValues((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  disabled={busyAction === "metadata"}
                />
              </FieldRow>
              <FieldRow label="Customer" htmlFor="pl-customer">
                <input
                  id="pl-customer"
                  value={metadataValues.customer_name || ""}
                  onChange={(event) =>
                    setMetadataValues((current) => ({
                      ...current,
                      customer_name: event.target.value,
                    }))
                  }
                  disabled={busyAction === "metadata"}
                  placeholder="Optional"
                />
              </FieldRow>
              <FieldRow label="Due date" htmlFor="pl-due">
                <input
                  id="pl-due"
                  type="date"
                  value={metadataValues.due_date || ""}
                  onChange={(event) =>
                    setMetadataValues((current) => ({
                      ...current,
                      due_date: event.target.value,
                    }))
                  }
                  disabled={busyAction === "metadata"}
                />
              </FieldRow>
            </FieldGroup>
            <FieldGroup label="Notes">
              <textarea
                value={metadataValues.notes || ""}
                onChange={(event) =>
                  setMetadataValues((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                disabled={busyAction === "metadata"}
                placeholder="Optional preparation instructions"
                className="item-panel-textarea"
              />
            </FieldGroup>
          </form>
        </DialogShell>
      )}

      {addOpen && (
        <DialogShell
          title="Add Item"
          eyebrow="From your inventory"
          description="Search by name, code, SKU, barcode, category, or supplier."
          onClose={() => setAddOpen(false)}
          closeDisabled={busyAction === "add-item"}
          className="ui-dialog-wide"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setAddOpen(false)}
                disabled={busyAction === "add-item"}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="pick-list-add-item"
                disabled={!selectedInventory}
                loading={busyAction === "add-item"}
                loadingLabel="Adding..."
              >
                Add to Pick List
              </Button>
            </>
          }
        >
          <div className="px-5 pb-4">
            <SearchInput
              label="Search inventory"
              value={itemSearch}
              onChange={setItemSearch}
              placeholder="Name, code, SKU, barcode, category, supplier"
              className="w-full"
              autoFocus
            />

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {visibleInventoryItems.length > 0 ? (
                visibleInventoryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedInventoryId(item.id)}
                    aria-pressed={selectedInventoryId === item.id}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedInventoryId === item.id
                        ? "border-sydin-blue/35 bg-sydin-blue/12"
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
                <div className="rounded-xl border border-dashed border-theme px-5 py-8 text-center text-sm text-theme-subtle">
                  No available inventory items match this search.
                </div>
              )}
            </div>

            <form
              id="pick-list-add-item"
              onSubmit={handleAddItem}
              className="mt-5 border-t border-theme pt-4"
            >
              {selectedInventory ? (
                <>
                  <p className="text-sm text-theme-muted">
                    <span className="font-semibold text-theme-primary">
                      {selectedInventory.name}
                    </span>
                    {" · "}
                    {getInventoryQuantityLabel(
                      selectedInventory.quantity,
                      selectedInventory.unit_type,
                      selectedInventory.custom_unit_label
                    )}{" "}
                    in stock
                  </p>

                  <div className="item-form -mx-6 mt-3">
                    <FieldGroup>
                      <FieldRow label="Quantity" htmlFor="pl-add-qty">
                        <input
                          id="pl-add-qty"
                          type="number"
                          min="1"
                          step="1"
                          value={addQuantity}
                          onChange={(event) => setAddQuantity(event.target.value)}
                          disabled={busyAction === "add-item"}
                        />
                      </FieldRow>
                      <FieldRow label="Line note" htmlFor="pl-add-note">
                        <input
                          id="pl-add-note"
                          value={addNotes}
                          onChange={(event) => setAddNotes(event.target.value)}
                          disabled={busyAction === "add-item"}
                          placeholder="Optional"
                        />
                      </FieldRow>
                    </FieldGroup>
                  </div>
                </>
              ) : (
                <p className="text-sm font-semibold text-theme-subtle">
                  Select an inventory item to continue.
                </p>
              )}

              {addError && (
                <div className="mt-4">
                  <DashboardNotice tone="danger">{addError}</DashboardNotice>
                </div>
              )}
            </form>
          </div>
        </DialogShell>
      )}

      {cancelOpen && (
        <DialogShell
          title={`Cancel ${detail.title}?`}
          eyebrow="Cancel Pick List"
          description="Stock will not change. The Pick List becomes permanently read-only and cannot be reopened."
          tone="danger"
          onClose={() => setCancelOpen(false)}
          closeDisabled={busyAction === "cancel"}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setCancelOpen(false)}
                disabled={busyAction === "cancel"}
              >
                Keep Active
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleCancel()}
                loading={busyAction === "cancel"}
                loadingLabel="Cancelling..."
              >
                Cancel Pick List
              </Button>
            </>
          }
        />
      )}

      {pendingRemove && (
        <DialogShell
          title={`Remove ${pendingRemove.item_name_snapshot}?`}
          eyebrow="Remove line item"
          description="This only removes the line from this Pick List. Inventory stock will not change."
          tone="danger"
          onClose={() => setPendingRemove(null)}
          closeDisabled={busyAction === "remove"}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setPendingRemove(null)}
                disabled={busyAction === "remove"}
              >
                Keep Item
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleRemove()}
                loading={busyAction === "remove"}
                loadingLabel="Removing..."
              >
                Remove Item
              </Button>
            </>
          }
        />
      )}

      {completeOpen && (
        <DialogShell
          title="Complete Pick List"
          eyebrow="Final review"
          description="Completion is permanent. It marks the list prepared and leaves inventory quantities unchanged."
          onClose={() => setCompleteOpen(false)}
          closeDisabled={busyAction === "complete"}
          className="ui-dialog-wide"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setCompleteOpen(false)}
                disabled={busyAction === "complete"}
              >
                Continue Preparing
              </Button>
              <Button
                onClick={() => void handleComplete()}
                disabled={!allPrepared}
                loading={busyAction === "complete"}
                loadingLabel="Completing..."
              >
                Complete Without Deducting
              </Button>
            </>
          }
        >
          <div className="px-5 pb-4">
            <div className="space-y-2">
              {detail.items.map((item) => {
                const shortage =
                  !item.inventory ||
                  item.inventory.quantity < item.required_quantity;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 ${
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
              <div className="mt-4">
                <DashboardNotice tone="warning">
                  Every line must be fully prepared before completion.
                </DashboardNotice>
              </div>
            )}

            {shortages.length > 0 && (
              <div className="mt-4">
                <DashboardNotice tone="warning">
                  {shortages.length} line{shortages.length === 1 ? "" : "s"}{" "}
                  {shortages.length === 1 ? "has" : "have"} a current stock
                  shortage. You can still complete this pick list because
                  inventory quantities are not deducted.
                </DashboardNotice>
              </div>
            )}

            {completionError && (
              <div className="mt-4">
                <DashboardNotice tone="danger">{completionError}</DashboardNotice>
              </div>
            )}
          </div>
        </DialogShell>
      )}
    </div>
  );
}
