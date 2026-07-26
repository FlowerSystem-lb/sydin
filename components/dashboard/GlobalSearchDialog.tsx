"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import {
  DEFAULT_MAX_RESULTS_PER_GROUP,
  GROUP_ICON,
  QUICK_ACTIONS,
  STATIC_ROUTES,
  SEARCH_MIN_LENGTH,
  clearRecentQueries,
  getSafeRecentQueries,
  getSafeRecentRoutes,
  groupResults,
  matchesQuickAction,
  rememberRecentQuery,
  rememberRecentRoute,
  type RecentRoute,
  type SearchGroup,
  type SearchResult,
} from "@/app/lib/globalSearch";
import { HighlightedText } from "@/components/dashboard/SearchHighlight";
import { useGlobalSearch } from "@/components/dashboard/useGlobalSearch";
import { cx } from "@/components/ui/utils";

interface GlobalSearchDialogProps {
  open: boolean;
  userId: string;
  pathname: string;
  onClose: () => void;
  /**
   * `anchored` renders the panel as a dropdown beneath the header search bar
   * (no full-screen scrim) — the header-bar click path. The default modal
   * presentation is kept for the Ctrl/Cmd+K palette, which can be invoked from
   * anywhere including screens where the bar is not visible.
   */
  anchored?: boolean;
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform || navigator.userAgent);
}

export default function GlobalSearchDialog({
  open,
  userId,
  pathname,
  onClose,
  anchored = false,
}: GlobalSearchDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeGroup, setActiveGroup] = useState<"All" | SearchGroup>("All");
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= SEARCH_MIN_LENGTH;

  const { results, loading, error } = useGlobalSearch({
    enabled: open,
    userId,
    pathname,
    query,
    maxResultsPerGroup: DEFAULT_MAX_RESULTS_PER_GROUP,
    depth: "preview",
  });

  const staticQuickResults = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) =>
        isSearching ? matchesQuickAction(action, query) : true
      ),
    [isSearching, query]
  );

  const emptyStateResults = useMemo(() => {
    const recentResults: SearchResult[] = recentRoutes.map((route) => ({
      id: `recent-${route.href}`,
      group: "Pages",
      title: route.label,
      subtitle: "Recently opened page",
      chip: "Recent",
      href: route.href,
      keywords: route.label,
    }));

    return [...recentResults, ...QUICK_ACTIONS];
  }, [recentRoutes]);

  const visibleResults = isSearching
    ? [...results, ...staticQuickResults]
    : emptyStateResults;
  const groupedResults = groupResults(visibleResults, DEFAULT_MAX_RESULTS_PER_GROUP);
  const availableGroups = useMemo(
    () => groupedResults.map(([group]) => group),
    [groupedResults]
  );
  const filteredGroupedResults =
    activeGroup === "All"
      ? groupedResults
      : groupedResults.filter(([group]) => group === activeGroup);
  const flatResults = filteredGroupedResults.flatMap(([, groupItems]) => groupItems);
  const activeResult = flatResults[activeIndex] || null;

  const closeDialog = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setActiveGroup("All");
    onClose();
  }, [onClose]);

  const openResult = useCallback(
    (result: SearchResult) => {
      rememberRecentRoute(result);
      if (isSearching) rememberRecentQuery(trimmedQuery);
      closeDialog();
      router.push(result.href);
    },
    [closeDialog, isSearching, router, trimmedQuery]
  );

  const viewAllResults = useCallback(() => {
    if (!isSearching) return;
    rememberRecentQuery(trimmedQuery);
    const query = encodeURIComponent(trimmedQuery);
    closeDialog();
    router.push(`/dashboard/search?q=${query}`);
  }, [closeDialog, isSearching, router, trimmedQuery]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      setRecentRoutes(getSafeRecentRoutes());
      setRecentQueries(getSafeRecentQueries());
      inputRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const label = STATIC_ROUTES[pathname];
    if (!label) return;

    rememberRecentRoute({
      id: `current-${pathname}`,
      group: "Pages",
      title: label,
      subtitle: "Recently opened page",
      chip: "Recent",
      href: pathname,
      keywords: label,
    });
  }, [open, pathname]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable || focusable.length <= 1) return; // Only input, no results

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDialog, open]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        flatResults.length === 0 ? 0 : (current + 1) % flatResults.length
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        flatResults.length === 0
          ? 0
          : (current - 1 + flatResults.length) % flatResults.length
      );
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      openResult(activeResult);
    }
  };

  if (!open) return null;

  const panel = (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={anchored ? undefined : "true"}
        aria-labelledby="global-search-title"
        className={
          anchored
            ? "global-search-panel global-search-panel-anchored flex max-h-[min(30rem,calc(100dvh-8rem))] w-full flex-col overflow-hidden text-theme-primary"
            : "global-search-panel flex max-h-[calc(100dvh-2rem)] w-full max-w-[42rem] flex-col overflow-hidden text-theme-primary sm:max-h-[38rem]"
        }
      >
        <div className="global-search-header">
          <UiIcon name="search" className="h-5 w-5 shrink-0 text-theme-subtle" />
          <div className="min-w-0 flex-1">
            <h2 id="global-search-title" className="sr-only">
              Global search
            </h2>
            <label htmlFor="global-search-input" className="sr-only">
              Search items, categories, suppliers, movements
            </label>
            <input
              ref={inputRef}
              id="global-search-input"
              type="search"
              value={query}
              onChange={(event) => {
                setActiveIndex(0);
                setActiveGroup("All");
                setQuery(event.target.value);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={`Search items, orders, suppliers, movements… (${isMac() ? "⌘" : "Ctrl"}+K)`}
              className="global-search-input"
              aria-controls="global-search-results"
              aria-activedescendant={activeResult?.id}
            />
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="global-search-close"
            aria-label="Close global search"
          >
            <UiIcon name="close" className="h-4 w-4" />
          </button>
        </div>

        {availableGroups.length > 1 && (
          <div className="global-search-tabs" role="tablist" aria-label="Filter results by type">
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === "All"}
              onClick={() => {
                setActiveGroup("All");
                setActiveIndex(0);
              }}
              className={cx(
                "global-search-tab",
                activeGroup === "All" && "global-search-tab-active"
              )}
            >
              All
            </button>
            {availableGroups.map((group) => (
              <button
                key={group}
                type="button"
                role="tab"
                aria-selected={activeGroup === group}
                onClick={() => {
                  setActiveGroup(group);
                  setActiveIndex(0);
                }}
                className={cx(
                  "global-search-tab",
                  activeGroup === group && "global-search-tab-active"
                )}
              >
                {group}
              </button>
            ))}
          </div>
        )}

        <div
          id="global-search-results"
          className="min-h-0 flex-1 overflow-y-auto p-2"
          role="listbox"
          aria-label="Global search results"
        >
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {loading && "Searching your workspace"}
            {error && error}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="animate-spin h-4 w-4 border-2 border-theme-accent border-t-transparent rounded-full" />
              <p className="global-search-status-row">Searching...</p>
            </div>
          )}
          {error && (
            <p role="alert" className="global-search-error-row">
              {error}
            </p>
          )}
          {!loading && !error && isSearching && flatResults.length === 0 && (
            <div className="px-4 py-10 text-center">
              <UiIcon name="search" className="mx-auto h-8 w-8 text-theme-accent" />
              <p className="mt-3 text-sm font-black text-theme-primary">
                No results found
              </p>
              <p className="mt-1 text-sm text-theme-muted">
                Try an item name, SKU, supplier, category, or movement note.
              </p>
            </div>
          )}
          {!isSearching && (
            <>
              <p className="px-3 pb-1 pt-1 text-xs font-semibold text-theme-muted">
                Type at least 2 characters to search everywhere in SydIN.
              </p>
              {recentQueries.length > 0 && (
                <section className="px-1 py-2">
                  <div className="flex items-center justify-between px-2 pb-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-theme-subtle">
                      Recent searches
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentQueries();
                        setRecentQueries([]);
                      }}
                      className="text-[10px] font-bold uppercase tracking-[0.08em] text-theme-subtle hover:text-theme-primary"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-2">
                    {recentQueries.map((recentQuery) => (
                      <button
                        key={recentQuery}
                        type="button"
                        onClick={() => setQuery(recentQuery)}
                        className="global-search-recent-chip"
                      >
                        <UiIcon name="clock" className="h-3.5 w-3.5" />
                        {recentQuery}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {filteredGroupedResults.map(([group, groupItems]) => (
            <section key={group} className="py-2" aria-label={group}>
              <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-theme-subtle">
                {group}
              </p>
              <div className="grid gap-1">
                {groupItems.map((result) => {
                  const resultIndex = flatResults.findIndex(
                    (item) => item.id === result.id
                  );
                  const active = resultIndex === activeIndex;

                  return (
                    <button
                      key={result.id}
                      id={result.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(resultIndex)}
                      onClick={() => openResult(result)}
                      className={cx(
                        "global-search-result-row",
                        active && "global-search-result-row-active"
                      )}
                    >
                      <span className="global-search-result-icon" aria-hidden="true">
                        <UiIcon name={GROUP_ICON[result.group]} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-theme-primary" title={result.title}>
                          <HighlightedText text={result.title} query={trimmedQuery} />
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-theme-muted" title={result.subtitle}>
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
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {isSearching && !loading && (
          <button
            type="button"
            onClick={viewAllResults}
            className="global-search-view-all"
          >
            <span>
              View all results for <strong>&ldquo;{trimmedQuery}&rdquo;</strong>
            </span>
            <UiIcon name="chevron-right" className="h-4 w-4" />
          </button>
        )}

        <div className="global-search-footer">
          <span>
            <kbd>&uarr;</kbd>
            <kbd>&darr;</kbd> Navigate
          </span>
          <span>
            <kbd>Tab</kbd> Cycle
          </span>
          <span>
            <kbd>&crarr;</kbd> Open
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
          <span className="ml-auto hidden sm:inline">
            <kbd>{isMac() ? "⌘" : "Ctrl"}</kbd>
            <kbd>K</kbd> to search anytime
          </span>
        </div>
      </div>
  );

  // Anchored: the caller positions this inside a relative container beneath the
  // search bar, so no scrim is rendered and the page stays visible behind it.
  if (anchored) return panel;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center bg-[var(--bg-overlay)] p-3 pt-16 backdrop-blur-md sm:p-6 sm:pt-[10vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      {panel}
    </div>
  );
}
