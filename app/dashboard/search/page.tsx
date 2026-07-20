"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import UiIcon from "@/components/UiIcon";
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
import { HighlightedText } from "@/components/dashboard/SearchHighlight";
import { useGlobalSearch } from "@/components/dashboard/useGlobalSearch";
import {
  GROUP_ICON,
  QUICK_ACTIONS,
  SEARCH_MIN_LENGTH,
  getSafeRecentQueries,
  groupResults,
  matchesQuickAction,
  rememberRecentQuery,
  type SearchGroup,
  type SearchResult,
} from "@/app/lib/globalSearch";
import { supabase } from "@/app/lib/supabase";
import { cx } from "@/components/ui/utils";

const SEARCH_PAGE_MAX_RESULTS_PER_GROUP = 40;
const URL_SYNC_DEBOUNCE_MS = 350;

type StockFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";

const STOCK_FILTER_TONE: Record<Exclude<StockFilter, "all">, string> = {
  "in-stock": "success",
  "low-stock": "warning",
  "out-of-stock": "danger",
};

export default function GlobalSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [userId, setUserId] = useState("");
  const [authError, setAuthError] = useState("");
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [activeGroup, setActiveGroup] = useState<"All" | SearchGroup>("All");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const trimmedQuery = queryInput.trim();
  const isSearching = trimmedQuery.length >= SEARCH_MIN_LENGTH;
  const syncedQueryRef = useRef(initialQuery);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        setAuthError("Please sign in again to search your workspace.");
        return;
      }
      setUserId(data.user.id);
    });

    const frame = window.requestAnimationFrame(() => {
      setRecentQueries(getSafeRecentQueries());
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (queryInput === syncedQueryRef.current) return;

    const timeout = window.setTimeout(() => {
      syncedQueryRef.current = queryInput;
      const params = new URLSearchParams(window.location.search);
      if (queryInput.trim()) {
        params.set("q", queryInput.trim());
      } else {
        params.delete("q");
      }
      const nextQuery = params.toString();
      router.replace(`/dashboard/search${nextQuery ? `?${nextQuery}` : ""}`);
    }, URL_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [queryInput, router]);

  const updateQuery = (value: string) => {
    setQueryInput(value);
    setActiveGroup("All");
    setStockFilter("all");
  };

  const { results, loading, error } = useGlobalSearch({
    enabled: Boolean(userId),
    userId,
    pathname: "/dashboard/search",
    query: queryInput,
    maxResultsPerGroup: SEARCH_PAGE_MAX_RESULTS_PER_GROUP,
    depth: "full",
  });

  useEffect(() => {
    if (isSearching && !loading && !error) {
      rememberRecentQuery(trimmedQuery);
    }
  }, [isSearching, loading, error, trimmedQuery]);

  const staticQuickResults = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) =>
        isSearching ? matchesQuickAction(action, queryInput) : true
      ),
    [isSearching, queryInput]
  );

  const visibleResults = isSearching
    ? [...results, ...staticQuickResults]
    : [];
  const groupedResults = groupResults(visibleResults, SEARCH_PAGE_MAX_RESULTS_PER_GROUP);
  const groupCounts = useMemo(
    () => new Map(groupedResults.map(([group, items]) => [group, items.length])),
    [groupedResults]
  );
  const totalCount = groupedResults.reduce((sum, [, items]) => sum + items.length, 0);

  const groupFilteredResults =
    activeGroup === "All"
      ? groupedResults
      : groupedResults.filter(([group]) => group === activeGroup);

  const stockFilteredResults: Array<[SearchGroup, SearchResult[]]> =
    stockFilter === "all"
      ? groupFilteredResults
      : groupFilteredResults
          .map(([group, items]): [SearchGroup, SearchResult[]] => [
            group,
            group === "Items"
              ? items.filter((item) => item.tone === STOCK_FILTER_TONE[stockFilter])
              : items,
          ])
          .filter(([, items]) => items.length > 0);

  const flatResultCount = stockFilteredResults.reduce(
    (sum, [, items]) => sum + items.length,
    0
  );
  const itemsGroupVisible = groupCounts.has("Items");

  return (
    <DashboardPageShell width="wide">
      <DashboardPageHeader
        eyebrow="Workspace"
        title="Search"
        description={
          isSearching
            ? `Results for “${trimmedQuery}”`
            : "Search items, categories, suppliers, locations, operations, and recent activity across SydIN."
        }
      />

      <DashboardToolbar className="grid gap-2 sm:grid-cols-1">
        <label className="relative block">
          <UiIcon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-subtle"
          />
          <input
            type="search"
            value={queryInput}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search items, orders, suppliers, movements..."
            autoFocus
            className="w-full rounded-xl border border-theme bg-theme-inset py-2.5 pl-10 pr-3 text-sm font-semibold text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
          />
        </label>
      </DashboardToolbar>

      {isSearching && groupedResults.length > 1 && (
        <FilterBar label="Filter by type" className="mt-3">
          <FilterChip active={activeGroup === "All"} count={totalCount} onClick={() => setActiveGroup("All")}>
            All
          </FilterChip>
          {groupedResults.map(([group, items]) => (
            <FilterChip
              key={group}
              active={activeGroup === group}
              count={items.length}
              onClick={() => setActiveGroup(group)}
            >
              {group}
            </FilterChip>
          ))}
        </FilterBar>
      )}

      {isSearching && itemsGroupVisible && (activeGroup === "All" || activeGroup === "Items") && (
        <FilterBar label="Filter by stock status" className="mt-2">
          <FilterChip active={stockFilter === "all"} onClick={() => setStockFilter("all")}>
            All stock
          </FilterChip>
          <FilterChip active={stockFilter === "in-stock"} onClick={() => setStockFilter("in-stock")}>
            In stock
          </FilterChip>
          <FilterChip active={stockFilter === "low-stock"} onClick={() => setStockFilter("low-stock")}>
            Low stock
          </FilterChip>
          <FilterChip active={stockFilter === "out-of-stock"} onClick={() => setStockFilter("out-of-stock")}>
            Out of stock
          </FilterChip>
        </FilterBar>
      )}

      <div className="mt-4">
        {authError && <DashboardNotice tone="danger">{authError}</DashboardNotice>}

        {!authError && !userId && <LoadingSkeletonGroup count={4} />}

        {!authError && userId && !isSearching && (
          <DashboardEmptyState
            icon="search"
            title="Search your workspace"
            description="Type at least 2 characters to search items, categories, suppliers, locations, operations, and activity — all from one place."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {recentQueries.slice(0, 5).map((recentQuery) => (
                  <button
                    key={recentQuery}
                    type="button"
                    onClick={() => updateQuery(recentQuery)}
                    className="global-search-recent-chip"
                  >
                    <UiIcon name="clock" className="h-3.5 w-3.5" />
                    {recentQuery}
                  </button>
                ))}
              </div>
            }
          />
        )}

        {!authError && userId && isSearching && loading && (
          <LoadingSkeletonGroup count={5} />
        )}

        {!authError && userId && isSearching && !loading && error && (
          <DashboardNotice tone="danger">{error}</DashboardNotice>
        )}

        {!authError && userId && isSearching && !loading && !error && flatResultCount === 0 && (
          <DashboardEmptyState
            icon="search"
            title="No results found"
            description="Try an item name, SKU, supplier, category, or movement note."
          />
        )}

        {!authError &&
          userId &&
          isSearching &&
          !loading &&
          !error &&
          flatResultCount > 0 &&
          stockFilteredResults.map(([group, items]) => (
            <section key={group} className="search-page-group">
              <p className="search-page-group-title">
                <UiIcon name={GROUP_ICON[group]} className="h-3.5 w-3.5" />
                {group}
                <span>({items.length})</span>
              </p>
              <div className="grid gap-2">
                {items.map((result) => (
                  <Link
                    key={result.id}
                    href={result.href}
                    className="search-page-result-row"
                  >
                    <span className="search-page-result-icon" aria-hidden="true">
                      <UiIcon name={GROUP_ICON[result.group]} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-theme-primary">
                        <HighlightedText text={result.title} query={trimmedQuery} />
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-theme-muted">
                        {result.subtitle}
                      </span>
                    </span>
                    <span
                      className={cx(
                        "shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
                        result.tone === "success" &&
                          "border-emerald-400/30 bg-emerald-500/10 text-theme-success",
                        result.tone === "warning" &&
                          "border-amber-300/30 bg-amber-500/10 text-theme-warning",
                        result.tone === "danger" &&
                          "border-red-400/30 bg-red-500/10 text-theme-danger",
                        result.tone === "accent" &&
                          "border-cyan-300/30 bg-cyan-500/10 text-theme-accent",
                        (!result.tone || result.tone === "default") &&
                          "border-theme bg-theme-inset text-theme-secondary"
                      )}
                    >
                      {result.chip}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
      </div>
    </DashboardPageShell>
  );
}
