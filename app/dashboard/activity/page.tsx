"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import {
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardToolbar,
  FilterBar,
  FilterChip,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { SearchInput, Select } from "@/components/ui";
import {
  getActivityFeed,
  getActivityEventLabel,
  getActivityEventIcon,
  getActivityEventTone,
  type ActivityEvent,
  type ActivityEventType,
} from "@/app/lib/activityFeed";
import { formatStockMovementNotes } from "@/app/lib/stockMovements";
import { supabase } from "@/app/lib/supabase";

type EventFilter = "all" | ActivityEventType;
type DateSort = "newest" | "oldest";

function formatEventDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatQuantityDelta(delta: number) {
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : String(delta);
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [dateSort, setDateSort] = useState<DateSort>("newest");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Please sign in again to view activity.");
    }

    return getActivityFeed(user.id, 200);
  };

  useEffect(() => {
    let active = true;

    loadData()
      .then((loadedEvents) => {
        if (!active) return;
        setEvents(loadedEvents);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load activity."
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleEvents = events
    .filter((event) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          event.itemName,
          event.poNumber,
          event.notes,
          getActivityEventLabel(event.type),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesType =
        eventFilter === "all" || event.type === eventFilter;

      return matchesSearch && matchesType;
    })
    .sort((first, second) => {
      const delta =
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime();
      return dateSort === "newest" ? delta : -delta;
    });

  const getToneColor = (tone: string) => {
    const toneMap: Record<string, string> = {
      success: "emerald",
      accent: "violet",
      danger: "red",
      warning: "amber",
      neutral: "slate",
    };
    return toneMap[tone] || "slate";
  };

  return (
    <DashboardPageShell as="main">
      <DashboardPageHeader
        eyebrow="Insights"
        title="Activity"
        description="Timeline of all inventory changes, item edits, and purchase order receipts."
      />

      {error && <DashboardNotice tone="danger">{error}</DashboardNotice>}

      <DashboardToolbar>
        {/* Both controls here were the odd ones out. The search box had a
            placeholder and no label at all -- a placeholder is not an
            accessible name, it disappears the moment you type -- and it was
            the only `rounded-2xl` search box with no icon and no focus ring.
            The sort was a bare native <select>, in an app where every other
            dropdown is the shared one. */}
        <div className="flex flex-wrap gap-3">
          <SearchInput
            label="Search activity"
            value={search}
            onChange={setSearch}
            placeholder="Search activity…"
            className="min-w-64"
          />

          <Select
            ariaLabel="Sort by date"
            value={dateSort}
            onChange={(value) => setDateSort(value as DateSort)}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ]}
          />
        </div>
      </DashboardToolbar>

      <FilterBar label="Filter events">
        <FilterChip
          active={eventFilter === "all"}
          count={events.length}
          onClick={() => setEventFilter("all")}
        >
          All
        </FilterChip>

        <FilterChip
          active={eventFilter === "stock_in"}
          count={events.filter((e) => e.type === "stock_in").length}
          onClick={() => setEventFilter("stock_in")}
        >
          Stock In
        </FilterChip>

        <FilterChip
          active={eventFilter === "stock_out"}
          count={events.filter((e) => e.type === "stock_out").length}
          onClick={() => setEventFilter("stock_out")}
        >
          Stock Out
        </FilterChip>

        <FilterChip
          active={eventFilter === "adjustment"}
          count={events.filter((e) => e.type === "adjustment").length}
          onClick={() => setEventFilter("adjustment")}
        >
          Adjustments
        </FilterChip>

        <FilterChip
          active={eventFilter === "damaged_lost"}
          count={events.filter((e) => e.type === "damaged_lost").length}
          onClick={() => setEventFilter("damaged_lost")}
        >
          Damaged/Lost
        </FilterChip>

        <FilterChip
          active={eventFilter === "item_created"}
          count={events.filter((e) => e.type === "item_created").length}
          onClick={() => setEventFilter("item_created")}
        >
          Created
        </FilterChip>

        <FilterChip
          active={eventFilter === "item_edited"}
          count={events.filter((e) => e.type === "item_edited").length}
          onClick={() => setEventFilter("item_edited")}
        >
          Edited
        </FilterChip>

        <FilterChip
          active={eventFilter === "po_received"}
          count={events.filter((e) => e.type === "po_received").length}
          onClick={() => setEventFilter("po_received")}
        >
          PO Received
        </FilterChip>
      </FilterBar>

      {loading ? (
        <LoadingSkeletonGroup count={5} />
      ) : visibleEvents.length > 0 ? (
        <div className="space-y-4">
          {visibleEvents.map((event) => {
            const tone = getActivityEventTone(event.type);
            const toneColor = getToneColor(tone);
            const label = getActivityEventLabel(event.type);
            const icon = getActivityEventIcon(event.type);

            return (
              <div
                key={event.id}
                className="rounded-[18px] border border-theme bg-theme-inset p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-${toneColor}-300/25 bg-${toneColor}-500/15 text-sm font-black`}
                      style={{
                        borderColor: `rgb(from ${toneColor === "emerald" ? "#10b981" : toneColor === "violet" ? "#8b5cf6" : toneColor === "red" ? "#ef4444" : toneColor === "amber" ? "#f59e0b" : "#64748b"} r g b / 0.25)`,
                        backgroundColor: `rgb(from ${toneColor === "emerald" ? "#10b981" : toneColor === "violet" ? "#8b5cf6" : toneColor === "red" ? "#ef4444" : toneColor === "amber" ? "#f59e0b" : "#64748b"} r g b / 0.15)`,
                        color:
                          toneColor === "emerald"
                            ? "#059669"
                            : toneColor === "violet"
                              ? "#7c3aed"
                              : toneColor === "red"
                                ? "#dc2626"
                                : toneColor === "amber"
                                  ? "#d97706"
                                  : "#475569",
                      }}
                    >
                      <UiIcon name={icon as UiIconName} className="h-5 w-5" />
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-theme-primary">
                        {label}
                      </h3>

                      <p className="mt-1 text-sm font-medium text-theme-muted">
                        {formatEventDate(event.createdAt)}
                      </p>

                      {event.itemName && (
                        <p className="mt-2 text-sm text-theme-secondary">
                          Item:{" "}
                          <Link
                            href={`/dashboard/inventory/${event.itemId}`}
                            className="font-semibold hover:underline"
                          >
                            {event.itemName}
                          </Link>
                        </p>
                      )}

                      {event.poNumber && (
                        <p className="mt-2 text-sm text-theme-secondary">
                          Purchase Order:{" "}
                          <Link
                            href={`/dashboard/purchase-orders`}
                            className="font-semibold hover:underline"
                          >
                            #{event.poNumber}
                          </Link>
                        </p>
                      )}

                      {event.notes && (
                        <p className="mt-3 max-w-2xl whitespace-pre-wrap break-normal text-sm leading-6 text-theme-secondary">
                          {formatStockMovementNotes(event.notes)}
                        </p>
                      )}
                    </div>
                  </div>

                  {(event.quantityBefore !== undefined ||
                    event.quantityAfter !== undefined) && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
                      {event.quantityBefore !== undefined && (
                        <div className="rounded-2xl border border-theme bg-theme-surface p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-subtle">
                            Before
                          </p>

                          <p className="mt-2 text-2xl font-black text-theme-primary">
                            {event.quantityBefore}
                          </p>
                        </div>
                      )}

                      {event.quantityDelta !== undefined && (
                        <div className="rounded-2xl border border-theme bg-theme-surface p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-subtle">
                            Change
                          </p>

                          <p
                            className={`mt-2 text-2xl font-black ${
                              event.quantityDelta < 0
                                ? "text-theme-danger"
                                : event.quantityDelta > 0
                                  ? "text-theme-success"
                                  : "text-theme-primary"
                            }`}
                          >
                            {formatQuantityDelta(event.quantityDelta)}
                          </p>
                        </div>
                      )}

                      {event.quantityAfter !== undefined && (
                        <div className="rounded-2xl border border-theme bg-theme-surface p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-subtle">
                            After
                          </p>

                          <p className="mt-2 text-2xl font-black text-theme-accent">
                            {event.quantityAfter}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DashboardEmptyState
          icon="layers"
          title="No activity yet"
          description="All inventory changes, item edits, and purchase order receipts will appear here."
        />
      )}
    </DashboardPageShell>
  );
}
