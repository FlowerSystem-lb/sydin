"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import UiIcon from "@/components/UiIcon";
import ItemDetailsSlideOver, {
  type SlideOverInventoryItem,
} from "@/components/inventory/ItemDetailsSlideOver";
import Select from "@/components/ui/Select";
import StockMovementDialog, {
  type MovementInventoryItem,
} from "@/components/inventory/StockMovementDialog";
import { formatDepotLabel, getDepotsForUser, type Depot } from "@/app/lib/depots";
import {
  formatStockMovementNotes,
  getRecentStockMovements,
  STOCK_MOVEMENT_LABELS,
  type StockMovement,
  type StockMovementType,
} from "@/app/lib/stockMovements";
import { supabase } from "@/app/lib/supabase";

interface InventoryItem extends MovementInventoryItem {
  image: string;
  depot_id?: number | null;
  item_code?: string | null;
}

type MovementFilter = "all" | StockMovementType;
type DateSort = "newest" | "oldest";

function formatMovementDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function StockMovementsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [movementFilter, setMovementFilter] =
    useState<MovementFilter>("all");
  const [depotFilter, setDepotFilter] = useState("all");
  const [dateSort, setDateSort] = useState<DateSort>("newest");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialItemId, setInitialItemId] = useState<number | null>(null);
  const [detailsItemId, setDetailsItemId] = useState<number | null>(null);

  const loadData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Please sign in again to view stock movements.");
    }

    const [{ data: itemRows, error: itemError }, recentMovements, loadedDepots] =
      await Promise.all([
        supabase
          .from("inventory")
          .select("id, name, quantity, image, sku, depot_id, item_code")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        getRecentStockMovements(user.id, 100),
        getDepotsForUser(user.id).catch(() => []),
      ]);

    if (itemError) throw itemError;

    return {
      items: (itemRows || []) as InventoryItem[],
      movements: recentMovements,
      depots: loadedDepots,
    };
  };

  useEffect(() => {
    let active = true;

    loadData()
      .then((result) => {
        if (!active) return;

        setItems(result.items);
        setMovements(result.movements);
        setDepots(result.depots);
        const requestedItem = Number(
          new URLSearchParams(window.location.search).get("item")
        );

        if (Number.isInteger(requestedItem) && requestedItem > 0) {
          setInitialItemId(requestedItem);
          setDialogOpen(true);
        }
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load stock movements."
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );
  const depotById = useMemo(
    () => new Map(depots.map((depot) => [depot.id, depot])),
    [depots]
  );
  const normalizedSearch = search.trim().toLowerCase();
  const visibleMovements = movements
    .filter((movement) => {
      const item = movement.item_id ? itemById.get(movement.item_id) : null;
      const matchesSearch =
        !normalizedSearch ||
        [item?.name, item?.sku, item?.item_code, movement.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesType =
        movementFilter === "all" ||
        movement.movement_type === movementFilter;
      const matchesDepot =
        depotFilter === "all" ||
        String(item?.depot_id || "unassigned") === depotFilter;

      return matchesSearch && matchesType && matchesDepot;
    })
    .sort((first, second) => {
      const delta =
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime();
      return dateSort === "newest" ? delta : -delta;
    });

  const currentContext = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (movementFilter !== "all") params.set("type", movementFilter);
    if (depotFilter !== "all") params.set("depot", depotFilter);
    if (dateSort !== "newest") params.set("sort", dateSort);
    const query = params.toString();
    return `/dashboard/stock-movements${query ? `?${query}` : ""}`;
  }, [dateSort, depotFilter, movementFilter, search]);

  const handleSlideOverItemUpdated = (
    updatedItem: SlideOverInventoryItem,
    movement?: StockMovement
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === updatedItem.id
          ? {
              ...item,
              name: updatedItem.name,
              quantity: updatedItem.quantity,
              image: updatedItem.image,
              sku: updatedItem.sku || null,
              depot_id: updatedItem.depot_id ?? null,
              item_code: updatedItem.item_code || null,
            }
          : item
      )
    );
    if (movement) {
      setMovements((current) => [
        { ...movement, item_id: updatedItem.id },
        ...current,
      ]);
    }
    setNotice("Stock movement recorded successfully.");
  };

  return (
    <main>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <section className="rounded-[24px] border border-theme bg-theme-surface p-4 shadow-[0_14px_42px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                Operations
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-theme-primary sm:text-4xl">
                Stock Movements
              </h1>
              <p className="mt-1 text-sm leading-6 text-theme-muted">
                Record stock changes and review the latest 100 movement entries.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInitialItemId(null);
                setDialogOpen(true);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/15"
            >
              <UiIcon name="plus" className="h-4 w-4" />
              Record Movement
            </button>
          </div>
        </section>

        {(notice || error) && (
          <p
            role={error ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              error
                ? "border-red-400/30 bg-red-500/10 text-theme-danger"
                : "border-emerald-400/30 bg-emerald-500/10 text-theme-success"
            }`}
          >
            {error || notice}
          </p>
        )}

        <section className="grid gap-2 rounded-[20px] border border-theme bg-theme-surface p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative">
            <span className="sr-only">Search movements</span>
            <UiIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item or note"
              className="w-full rounded-xl border border-theme bg-theme-inset py-2.5 pl-10 pr-3 text-sm text-theme-primary outline-none focus:border-indigo-300/60 focus:ring-4 focus:ring-indigo-400/10"
            />
          </label>
          <Select
            ariaLabel="Movement type"
            value={movementFilter}
            onChange={(value) =>
              setMovementFilter(value as MovementFilter)
            }
            options={[
              { value: "all", label: "All movement types" },
              ...Object.entries(STOCK_MOVEMENT_LABELS).map(
                ([value, label]) => ({ value, label })
              ),
            ]}
          />
          <Select
            ariaLabel="Depot"
            value={depotFilter}
            onChange={setDepotFilter}
            searchable={depots.length > 8}
            options={[
              { value: "all", label: "All depots" },
              { value: "unassigned", label: "Unassigned" },
              ...depots.map((depot) => ({
                value: String(depot.id),
                label: formatDepotLabel(depot),
              })),
            ]}
          />
          <Select
            ariaLabel="Date sorting"
            value={dateSort}
            onChange={(value) => setDateSort(value as DateSort)}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ]}
          />
        </section>

        <section className="overflow-hidden rounded-[22px] border border-theme bg-theme-surface shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="h-20 animate-pulse rounded-xl bg-theme-inset"
                />
              ))}
            </div>
          ) : visibleMovements.length > 0 ? (
            <div className="divide-y divide-[var(--border-default)]">
              {visibleMovements.map((movement) => {
                const item = movement.item_id
                  ? itemById.get(movement.item_id)
                  : null;
                const depot = item?.depot_id
                  ? depotById.get(item.depot_id)
                  : null;
                const positive = movement.quantity_delta > 0;

                return (
                  <article
                    key={movement.id}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(90px,0.45fr))] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-theme bg-theme-inset">
                        {item?.image ? (
                          <Image
                            src={item.image}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-theme-subtle">
                            <UiIcon name="box" className="h-5 w-5" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        {item ? (
                          <button
                            type="button"
                            onClick={() => setDetailsItemId(item.id)}
                            className="block max-w-full truncate text-left font-bold text-theme-primary hover:text-theme-accent"
                          >
                            {item.name}
                          </button>
                        ) : (
                          <p className="truncate font-bold text-theme-primary">
                            Inventory item
                          </p>
                        )}
                        <p className="mt-0.5 truncate text-xs text-theme-subtle">
                          {STOCK_MOVEMENT_LABELS[movement.movement_type]} ·{" "}
                          {formatDepotLabel(depot)}
                        </p>
                        {movement.notes && (
                          <p className="mt-1 truncate text-xs text-theme-muted">
                            {formatStockMovementNotes(movement.notes)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                        Change
                      </p>
                      <p
                        className={`mt-1 font-black ${
                          positive
                            ? "text-theme-success"
                            : movement.quantity_delta < 0
                              ? "text-theme-danger"
                              : "text-theme-primary"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {movement.quantity_delta}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                        Before → After
                      </p>
                      <p className="mt-1 font-black text-theme-primary">
                        {movement.quantity_before} → {movement.quantity_after}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-theme-subtle">
                        Date
                      </p>
                      <p className="mt-1 text-xs font-semibold text-theme-secondary">
                        {formatMovementDate(movement.created_at)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-16 text-center">
              <UiIcon
                name="movement"
                className="mx-auto h-8 w-8 text-theme-accent"
              />
              <h2 className="mt-4 text-xl font-bold text-theme-primary">
                No movements found
              </h2>
              <p className="mt-2 text-sm text-theme-muted">
                Record a movement or adjust the filters.
              </p>
            </div>
          )}
        </section>
      </div>

      {detailsItemId && (
        <ItemDetailsSlideOver
          itemId={detailsItemId}
          returnTo={currentContext}
          onClose={() => setDetailsItemId(null)}
          onItemUpdated={handleSlideOverItemUpdated}
        />
      )}

      <StockMovementDialog
        open={dialogOpen}
        items={items}
        initialItemId={initialItemId}
        onClose={() => setDialogOpen(false)}
        onRecorded={async (movement, itemId) => {
          setItems((current) =>
            current.map((item) =>
              item.id === itemId
                ? { ...item, quantity: movement.quantity_after }
                : item
            )
          );
          setMovements((current) => [
            { ...movement, item_id: itemId },
            ...current,
          ]);
          setNotice("Stock movement recorded successfully.");
        }}
      />
    </main>
  );
}
