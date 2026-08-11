/**
 * Notification Center, light v1 (backlog §6). Computed live from data that
 * already exists — no new table, no persistence, no read/unread state.
 * Founder's own scoping call: ship this first, add real persisted
 * notifications later if it proves useful.
 *
 * The low-stock half deliberately mirrors app/dashboard/alerts/page.tsx's
 * `alertEntries` calculation exactly (same threshold resolution, same
 * out/low/in classification, same sort) rather than a simplified variant —
 * so the bell's count always agrees with what Stock Alerts itself shows.
 */
import { supabase } from "@/app/lib/supabase";
import { getEffectiveItemLowStockThreshold } from "@/app/lib/inventoryItemModel";
import {
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  type UserSubscription,
} from "@/app/lib/subscription";
import type { BusinessSettings } from "@/app/lib/businessSettings";
import { getActivityFeed, type ActivityEvent } from "@/app/lib/activityFeed";

export type LowStockPreviewState = "out" | "low";

export interface LowStockPreviewItem {
  id: number;
  name: string;
  quantity: number;
  threshold: number;
  state: LowStockPreviewState;
}

export interface NotificationsPreview {
  lowStock: LowStockPreviewItem[];
  /** May exceed lowStock.length — the dropdown shows a slice, this is the true count. */
  lowStockTotal: number;
  activity: ActivityEvent[];
}

const PREVIEW_LOW_STOCK_LIMIT = 5;
const PREVIEW_ACTIVITY_LIMIT = 5;

export async function getNotificationsPreview(
  userId: string,
  subscription: UserSubscription,
  businessSettings: BusinessSettings
): Promise<NotificationsPreview> {
  const [{ data: itemRows }, activity] = await Promise.all([
    supabase
      .from("inventory")
      .select("id, name, quantity, min_stock_level")
      .eq("user_id", userId),
    getActivityFeed(userId, PREVIEW_ACTIVITY_LIMIT).catch(
      () => [] as ActivityEvent[]
    ),
  ]);

  const capabilities = getSubscriptionCapabilities(subscription);
  const defaultThreshold = getEffectiveLowStockThreshold(
    subscription,
    businessSettings.low_stock_threshold
  );

  const lowStockAll = (itemRows || [])
    .map((item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const threshold = capabilities.customLowStockThreshold
        ? getEffectiveItemLowStockThreshold(item.min_stock_level, defaultThreshold)
        : defaultThreshold;
      const state: LowStockPreviewState | "in" =
        quantity <= 0 ? "out" : quantity <= threshold ? "low" : "in";

      return {
        id: item.id as number,
        name: (item.name as string) || "Unnamed item",
        quantity,
        threshold,
        state,
      };
    })
    .filter(
      (entry): entry is LowStockPreviewItem => entry.state !== "in"
    )
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === "out" ? -1 : 1;
      return a.quantity - b.quantity;
    });

  return {
    lowStock: lowStockAll.slice(0, PREVIEW_LOW_STOCK_LIMIT),
    lowStockTotal: lowStockAll.length,
    activity,
  };
}
