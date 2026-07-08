"use client";

import { useEffect, useRef, useState } from "react";
import {
  runGlobalSearch,
  sanitizeSearchTerm,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_LENGTH,
  type RunGlobalSearchOptions,
  type SearchResult,
} from "@/app/lib/globalSearch";

interface UseGlobalSearchOptions extends RunGlobalSearchOptions {
  enabled: boolean;
  userId: string;
  pathname: string;
  query: string;
}

/** Debounced, stale-request-safe wrapper around runGlobalSearch shared by the command palette and the /dashboard/search page. */
export function useGlobalSearch({
  enabled,
  userId,
  pathname,
  query,
  maxResultsPerGroup,
  depth,
}: UseGlobalSearchOptions) {
  const requestRef = useRef(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;

    const sanitizedTerm = sanitizeSearchTerm(query);

    if (sanitizedTerm.length < SEARCH_MIN_LENGTH) {
      requestRef.current += 1;
      const frame = window.requestAnimationFrame(() => {
        setResults([]);
        setLoading(false);
        setError("");
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    const frame = window.requestAnimationFrame(() => {
      setLoading(true);
      setError("");
    });

    const timeout = window.setTimeout(() => {
      runGlobalSearch(userId, pathname, sanitizedTerm, { maxResultsPerGroup, depth })
        .then(({ results: nextResults, failed }) => {
          if (requestRef.current !== requestId) return;
          setResults(nextResults);
          setError(failed ? "Search is unavailable right now. Try again in a moment." : "");
          setLoading(false);
        })
        .catch(() => {
          if (requestRef.current !== requestId) return;
          setResults([]);
          setError("Search is unavailable right now. Try again in a moment.");
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [enabled, userId, pathname, query, maxResultsPerGroup, depth]);

  return { results, loading, error };
}
