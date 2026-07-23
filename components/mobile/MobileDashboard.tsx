"use client";

import Link from "next/link";
import UiIcon from "@/components/UiIcon";

interface MobileDashboardProps {
  lowStockCount: number;
  outOfStockCount: number;
}

export default function MobileDashboard({
  lowStockCount,
  outOfStockCount,
}: MobileDashboardProps) {
  return (
    <div className="mobile-dashboard">
      <div className="mobile-dashboard-header">
        <h1 className="mobile-dashboard-title">Dashboard</h1>
      </div>

      <div className="space-y-3">
        {outOfStockCount > 0 && (
          <Link href="/dashboard/alerts" className="mobile-metric-card mobile-metric-card-danger">
            <div className="mobile-metric-icon">
              <UiIcon name="alert" className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="mobile-metric-label">Out of stock</div>
              <div className="mobile-metric-value">{outOfStockCount} items</div>
            </div>
            <UiIcon name="chevron-right" className="h-5 w-5 opacity-40" />
          </Link>
        )}

        {lowStockCount > 0 && (
          <Link href="/dashboard/alerts" className="mobile-metric-card mobile-metric-card-warning">
            <div className="mobile-metric-icon">
              <UiIcon name="alert" className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="mobile-metric-label">Low stock</div>
              <div className="mobile-metric-value">{lowStockCount} items</div>
            </div>
            <UiIcon name="chevron-right" className="h-5 w-5 opacity-40" />
          </Link>
        )}

        {(outOfStockCount === 0 && lowStockCount === 0) && (
          <div className="mobile-metric-card mobile-metric-card-success">
            <div className="mobile-metric-icon">
              <UiIcon name="check" className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="mobile-metric-label">All stocked</div>
              <div className="mobile-metric-value">No action needed</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2">
        <h2 className="mobile-dashboard-section-title">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dashboard/add-item" className="mobile-action-btn">
            <UiIcon name="plus" className="h-5 w-5" />
            <span>Add</span>
          </Link>
          <Link href="/dashboard/scanner" className="mobile-action-btn">
            <UiIcon name="scan" className="h-5 w-5" />
            <span>Scan</span>
          </Link>
          <Link href="/dashboard/purchase-orders/new" className="mobile-action-btn">
            <UiIcon name="file" className="h-5 w-5" />
            <span>PO</span>
          </Link>
          <Link href="/dashboard/qr-center" className="mobile-action-btn">
            <UiIcon name="qr" className="h-5 w-5" />
            <span>Labels</span>
          </Link>
        </div>
      </div>

      <div className="h-6"></div>
    </div>
  );
}
