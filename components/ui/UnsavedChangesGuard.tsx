"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "./Button";
import { DialogShell } from "./Overlay";

/**
 * Stops a half-filled form from disappearing when someone clicks away.
 *
 * Two of these existed before, hand-written and identical, on Receiving and
 * Stock Counts -- and both only guarded `beforeunload`, which fires when you
 * close the tab or hit refresh. That is not how the work was actually being
 * lost. The way you lose a purchase order you have spent five minutes on is
 * by clicking "Inventory" in the sidebar, and `beforeunload` never hears
 * about that: it is a client-side route change, not a page unload.
 *
 * So this covers both:
 *
 * - `beforeunload` for closing and refreshing, where the browser insists on
 *   showing its own wording and there is nothing to be done about that.
 * - A capture-phase click listener for links inside the app, where we can ask
 *   properly, in the product's own dialog, and say what happens to the work.
 *
 * Deliberately a component and not a hook returning state: the whole point is
 * that adding it to a form is one line and carries its own dialog, because a
 * guard that each page has to wire up by hand is a guard that pages forget.
 */
export default function UnsavedChangesGuard({
  when,
  what = "this form",
}: {
  /** True while there is work that would be lost. */
  when: boolean;
  /** Named in the dialog: "Leave the new purchase order?" */
  what?: string;
}) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Closing the tab or reloading. The browser shows its own text here; the
  // only thing a page can do is ask it to ask.
  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [when]);

  // Links inside the app. Capture phase, so this runs before Next's own
  // router picks the click up and starts navigating.
  useEffect(() => {
    if (!when) return;

    const handleClick = (event: MouseEvent) => {
      // Let the browser's own gestures through untouched: a new tab, a
      // download, a middle-click, anything with a modifier held.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      // Same page, nothing to lose. Compared on PATH only, so a link that
      // just changes the query -- Settings moving between its own sections,
      // Inventory applying a filter -- is not treated as leaving.
      const target = new URL(href, window.location.origin);
      if (target.pathname === window.location.pathname) return;

      // Off-site links are the browser's business; `beforeunload` covers them.
      if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [when]);

  const leave = useCallback(() => {
    if (!pendingHref) return;
    const href = pendingHref;
    setPendingHref(null);
    // The dialog only unmounts on the next render, and the listener is still
    // attached until `when` goes false -- push on the next frame so the
    // navigation is not caught by the guard that just released it.
    window.requestAnimationFrame(() => router.push(href));
  }, [pendingHref, router]);

  if (!pendingHref) return null;

  return (
    <DialogShell
      title={`Leave ${what}?`}
      eyebrow="Unsaved changes"
      description="What you have filled in has not been saved yet, and leaving this page will discard it."
      tone="danger"
      className="max-w-md"
      onClose={() => setPendingHref(null)}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => setPendingHref(null)}
            className="flex-1"
          >
            Keep editing
          </Button>
          <Button variant="danger" onClick={leave} className="flex-1">
            Discard and leave
          </Button>
        </>
      }
    />
  );
}
