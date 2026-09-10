"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ContextBackButton from "@/components/navigation/ContextBackButton";
import AddItemForm from "./AddItemForm";

/* This route still exists for the places that reach Add Item without already
   being on Inventory -- the header's own "+ Add" menu, the mobile quick
   action, global search, Categories' own "Add item to this category" link,
   the onboarding checklist. Inventory itself no longer uses it: it opens
   AddItemForm in a modal instead, the same way Edit Item already does. All
   the actual form logic lives in AddItemForm; this page is just its chrome
   plus the query-string deep links (`?category=`, `?barcode=`, `?returnTo=`)
   that only make sense when you arrive here from somewhere else. */
interface DeepLinkParams {
  backLabel: string;
  initialBarcode?: string;
  returnTo?: string;
}

const DEFAULT_DEEP_LINK_PARAMS: DeepLinkParams = {
  backLabel: "Back to Inventory",
};

export default function AddItemPage() {
  const router = useRouter();
  const [deepLink, setDeepLink] = useState<DeepLinkParams>(
    DEFAULT_DEEP_LINK_PARAMS
  );
  const { backLabel, initialBarcode, returnTo } = deepLink;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedBarcode = params.get("barcode") || undefined;
    const requestedReturnTo = params.get("returnTo") || undefined;

    if (!requestedBarcode && !requestedReturnTo) return;

    // One-time read of the URL this page was opened with -- there is no
    // React-tracked value to derive this from, so it has to live in an
    // effect. Batched into a single update rather than three, which is the
    // one that actually earns the disable below.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time `?barcode=`/`?returnTo=` deep-link read, not derivable from render
    setDeepLink({
      backLabel: requestedReturnTo?.startsWith("/dashboard/categories")
        ? "Back to Categories"
        : "Back to Inventory",
      initialBarcode: requestedBarcode,
      returnTo: requestedReturnTo,
    });
    // `category` is read by AddItemForm itself, alongside the category list
    // it already loads -- duplicating that fetch here just to validate the
    // id one render earlier isn't worth it.
  }, []);

  const goBack = () => {
    router.push(
      returnTo?.startsWith("/dashboard") && !returnTo.startsWith("//")
        ? returnTo
        : "/dashboard/inventory"
    );
  };

  return (
    <div className="contents">
      <main className="operations-workspace operations-add-item">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3">
          {/* The top bar already reads "Inventory / Add Item", so the eyebrow and
              heading only repeat it above 640px — hidden there, kept for screen
              readers, and left visible on phones where the chrome title is
              sr-only. Same rule as every other page header. */}
          <section className="rounded-[14px] border border-theme bg-theme-surface px-4 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent sm:hidden">
                  New product
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-theme-primary sm:sr-only sm:mt-0">
                  Add Item
                </h1>
                {/* Described the disclosure ("...when you're ready") that this
                    page no longer has: at full width the form shows every field
                    at once, so there is nothing left to come back for. */}
                <p className="mt-1 max-w-xl text-sm leading-6 text-theme-muted sm:mt-0">
                  Only the name is required &mdash; fill in the rest as you go.
                </p>
              </div>

              <ContextBackButton
                fallbackHref="/dashboard/inventory"
                label={backLabel}
                className="min-h-10 rounded-xl px-3.5 py-2 text-sm"
              />
            </div>
          </section>

          <AddItemForm
            initialBarcode={initialBarcode}
            onCancel={goBack}
            onSaved={goBack}
          />
        </div>
      </main>
    </div>
  );
}
