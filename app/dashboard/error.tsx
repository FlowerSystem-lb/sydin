"use client";

import { useEffect } from "react";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardPageShell,
} from "@/components/dashboard/Workspace";

// Error boundary for every dashboard route. Before this existed, an unhandled
// render error took the whole page to a blank screen with no way back. Keeps
// the shell and sidebar alive, so the rest of the app stays reachable.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing here is shown to the customer — the digest is the only handle we
    // have on a production stack trace, so keep it in the browser console.
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <DashboardPageShell>
      <DashboardEmptyState
        icon="info"
        title="This page could not load"
        description="Something went wrong on our side. Your data is safe — nothing was changed. Try again, or go back to your dashboard."
        action={
          <>
            <ActionButton onClick={reset} icon="check">
              Try again
            </ActionButton>

            <ActionButton href="/dashboard" variant="secondary">
              Back to Dashboard
            </ActionButton>
          </>
        }
      />

      {error.digest && (
        <p className="text-center text-xs text-theme-muted">
          Reference code: {error.digest}
        </p>
      )}
    </DashboardPageShell>
  );
}
