"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardTable,
} from "@/components/dashboard/Workspace";
import BulkPhotoDialog from "@/components/inventory/BulkPhotoDialog";
import type { PhotoTargetItem } from "@/app/lib/bulkItemPhotos";
import { supabase } from "@/app/lib/supabase";
import {
  getImportExportHistory,
  type ImportExportRecord,
} from "@/app/lib/importExportHistory";

export default function ImportExportPage() {
  const [history, setHistory] = useState<ImportExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Both halves of "batch photos" already existed and neither was reachable
   * from the page named for bulk data. Photos alongside a spreadsheet live in
   * the CSV/Excel importer; photos for items that already exist live behind the
   * Inventory ⋯ menu. Someone looking for either one comes here first.
   */
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoItems, setPhotoItems] = useState<PhotoTargetItem[]>([]);
  const [photoItemsLoading, setPhotoItemsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setLoading(false);
          return;
        }

        getImportExportHistory(user.id, 100).then((records) => {
          if (isActive) {
            setHistory(records);
            setLoading(false);
          }
        });
      })
      .catch(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  /**
   * The item list is fetched only when the dialog is asked for, not on page
   * load. This page is opened to read history far more often than to attach
   * photos, and the matcher needs every item -- name, SKU, barcode and item
   * code -- which is a bigger read than the history it sits next to.
   */
  const openPhotoDialog = useCallback(async () => {
    setPhotoDialogOpen(true);

    if (photoItems.length > 0 || photoItemsLoading) return;

    setPhotoItemsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("inventory")
        .select("id, name, sku, barcode, item_code, image")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      setPhotoItems((data as PhotoTargetItem[] | null) || []);
    } finally {
      setPhotoItemsLoading(false);
    }
  }, [photoItems.length, photoItemsLoading]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-emerald-500/10 border-emerald-300/30 text-emerald-700";
      case "error":
        return "bg-red-500/10 border-red-300/30 text-red-700";
      case "processing":
        return "bg-blue-500/10 border-blue-300/30 text-blue-700";
      default:
        return "bg-theme-surface border-theme text-theme-primary";
    }
  };

  return (
    <DashboardPageShell as="main">
      <DashboardPageHeader
        eyebrow="Data"
        title="Import & Export"
        description="Manage your inventory imports and exports. View history of all operations."
      />

      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        {/* Three ways in and out, each saying which job it does.
            The old row was two buttons: one link, and one disabled button
            labelled "Export CSV" that could never do anything and only told you
            why on hover -- a control that exists to refuse. Exports live on the
            Inventory page because they follow whatever you have filtered there,
            so this now goes to that page instead of pretending. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DataActionCard
            icon="sheet"
            title="A spreadsheet, with photos"
            description="Bring in many products at once from CSV or Excel. Photos can come with it — name each file after its row and they attach as the products are created."
            href="/dashboard/inventory/import"
            actionLabel="Start an import"
          />

          <DataActionCard
            icon="upload"
            title="Photos for items you already have"
            description="No spreadsheet. Drop a folder of photos and they match to products by SKU, barcode, item code or name. Anything that matches nothing, you point at an item yourself."
            onClick={() => void openPhotoDialog()}
            actionLabel={photoItemsLoading ? "Loading items..." : "Add photos"}
            disabled={photoItemsLoading}
          />

          <DataActionCard
            icon="download"
            title="Take your data out"
            description="CSV, Excel or PDF, from the Inventory page. Exports follow whatever you have filtered on screen, which is why they live there and not here."
            href="/dashboard/inventory"
            actionLabel="Go to Inventory"
          />
        </div>

        {/* History section */}
        {/* DashboardTable owns the loading, empty and horizontal-scroll cases,
            so this page no longer hand-rolls its own ternary chain and its own
            scroll container. It was the first consumer of a primitive that had
            been built, given loading/empty props, and then used nowhere. */}
        <DashboardTable
          loading={loading}
          loadingRows={4}
          empty={
            history.length === 0 ? (
              <DashboardEmptyState
                icon="file"
                title="No import or export history yet"
                description="Your import and export operations will appear here. Get started by importing or exporting inventory."
                action={
                  <ActionButton href="/dashboard/inventory/import" icon="upload">
                    Start an Import
                  </ActionButton>
                }
              />
            ) : undefined
          }
        >
              <thead>
                <tr className="border-b border-theme">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-theme-secondary">
                    Operation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-theme-secondary">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-theme-secondary">
                    Items
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-theme-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-theme-secondary">
                    Date
                  </th>
                  {history.some((h) => h.error_message) && (
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-theme-secondary">
                      Details
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-theme/30 hover:bg-theme-hover"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UiIcon
                          name={
                            record.operation_type === "import"
                              ? "upload"
                              : "download"
                          }
                          className="h-4 w-4 text-theme-secondary"
                        />
                        <span className="text-sm font-semibold capitalize">
                          {record.operation_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-theme-primary truncate">
                        {record.file_name}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-theme-primary">
                        {record.item_count}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusColor(
                          record.status
                        )}`}
                      >
                        <UiIcon
                          name={
                            record.status === "success"
                              ? "check"
                              : record.status === "error"
                              ? "alert"
                              : "clock"
                          }
                          className="h-3.5 w-3.5"
                        />
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-theme-secondary">
                        {formatDate(record.created_at)}
                      </p>
                    </td>
                    {history.some((h) => h.error_message) && (
                      <td className="px-4 py-3">
                        {record.error_message && (
                          <p className="text-xs text-red-600 max-w-xs truncate">
                            {record.error_message}
                          </p>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
        </DashboardTable>
      </div>

      <BulkPhotoDialog
        open={photoDialogOpen}
        items={photoItems}
        onClose={() => setPhotoDialogOpen(false)}
        onUploaded={() => {
          /* The attached photos are on the items, not on this page, so there is
             nothing here to refresh. Clearing the cached list means re-opening
             the dialog re-reads them and shows the new photos rather than the
             stale "no photo" state it was opened with. */
          setPhotoItems([]);
        }}
      />
    </DashboardPageShell>
  );
}

/**
 * One card shape for the three ways data moves. Either it links somewhere or it
 * does something here, never both, so the card takes one or the other.
 */
function DataActionCard({
  icon,
  title,
  description,
  href,
  onClick,
  actionLabel,
  disabled = false,
}: {
  icon: UiIconName;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  actionLabel: string;
  disabled?: boolean;
}) {
  const body = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-theme bg-theme-inset text-theme-accent">
        <UiIcon name={icon} className="h-4 w-4" />
      </span>
      <span className="mt-3 block text-sm font-semibold text-theme-primary">
        {title}
      </span>
      <span className="mt-1.5 block text-xs leading-5 text-theme-muted">
        {description}
      </span>
      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-theme-accent">
        {actionLabel}
        <UiIcon name="chevron-right" className="h-3.5 w-3.5" />
      </span>
    </>
  );

  const className =
    "flex min-h-11 flex-col rounded-2xl border border-theme bg-theme-surface p-4 text-left transition hover:bg-theme-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60";

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {body}
    </button>
  );
}
