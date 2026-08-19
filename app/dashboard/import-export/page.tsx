"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { supabase } from "@/app/lib/supabase";
import {
  getImportExportHistory,
  type ImportExportRecord,
} from "@/app/lib/importExportHistory";

export default function ImportExportPage() {
  const [history, setHistory] = useState<ImportExportRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
        {/* Quick action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard/inventory/import"
            className="flex items-center justify-center gap-2.5 rounded-xl border border-theme bg-theme-surface px-5 py-3 text-sm font-semibold text-theme-primary transition hover:bg-theme-hover"
          >
            <UiIcon name="upload" className="h-4 w-4" />
            Import CSV / Excel
          </Link>

          <button
            type="button"
            className="flex items-center justify-center gap-2.5 rounded-xl border border-theme bg-theme-surface px-5 py-3 text-sm font-semibold text-theme-primary transition hover:bg-theme-hover disabled:opacity-60"
            disabled
            title="Export from inventory page"
          >
            <UiIcon name="download" className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* History section */}
        {loading ? (
          <LoadingSkeletonGroup count={4} itemClassName="min-h-16" />
        ) : history.length === 0 ? (
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
        ) : (
          <div className="overflow-x-auto rounded-xl border border-theme bg-theme-surface">
            <table className="w-full">
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
            </table>
          </div>
        )}
      </div>
    </DashboardPageShell>
  );
}
