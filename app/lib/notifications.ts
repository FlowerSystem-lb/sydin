import { getOrCreateBusinessSettings } from "@/app/lib/businessSettings";
import { getEffectiveItemLowStockThreshold } from "@/app/lib/inventoryItemModel";
import { supabase } from "@/app/lib/supabase";
import {
  getEffectiveLowStockThreshold,
  getUserSubscription,
} from "@/app/lib/subscription";

// backlog §6, light v1 -> persisted (2026-08-12). Scoped to "low_stock" and
// "out_of_stock" only — see sql/phase-13-notifications.sql for why the other
// backlog categories (Billing/AI/Team/Product announcements) are not
// generated: none of them have a real trigger in the app yet, and a
// notification center that occasionally lies is worse than a small one.
export type NotificationType = "low_stock" | "out_of_stock";

export interface Notification {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  item_id: number | null;
  link_href: string | null;
  read_at: string | null;
  created_at: string;
}

function isMissingTableError(error: { code?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "PGRST204";
}

/** Table not migrated yet on this workspace — every function below fails
 * silently to an empty/zero state rather than throwing, so the bell icon
 * degrades gracefully instead of breaking the dashboard shell for every
 * page load until the founder runs sql/phase-13-notifications.sql. */
export async function isNotificationsMigrationMissing(): Promise<boolean> {
  const { error } = await supabase.from("notifications").select("id").limit(1);
  return isMissingTableError(error);
}

export async function getNotifications(
  userId: string,
  limit = 30
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data as Notification[]) || [];
}

export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) return 0;

  return count || 0;
}

export async function markNotificationRead(id: number): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  itemId?: number;
  linkHref?: string;
}): Promise<void> {
  await supabase.from("notifications").insert([
    {
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body || null,
      item_id: params.itemId ?? null,
      link_href: params.linkHref || null,
    },
  ]);
}

/**
 * Called by recordStockMovement() after a movement succeeds — the one place
 * every stock-change path in the app already funnels through (Scanner's 8
 * modes, the item page, the slide-over, Receiving, Stock Counts), so hooking
 * in here gives complete coverage without touching any of those 6 call
 * sites individually or duplicating threshold logic in the record_stock_movement
 * SQL function.
 *
 * Fires only on a genuine CROSSING — quantityBefore was above the threshold
 * and quantityAfter is not — not on every movement of an already-low item,
 * which would just be noise on top of the Stock Alerts page that already
 * shows current state live.
 *
 * Best-effort and silent: notification failures must never surface to the
 * user or block the stock movement that triggered them. A dropped
 * notification is a missed badge; a blocked movement is data loss.
 */
export async function notifyIfCrossedIntoLowStock(params: {
  userId: string;
  itemId: number;
  quantityBefore: number;
  quantityAfter: number;
}): Promise<void> {
  try {
    const { userId, itemId, quantityBefore, quantityAfter } = params;

    const [{ data: itemRow }, subscription, businessSettings] =
      await Promise.all([
        supabase
          .from("inventory")
          .select("name, min_stock_level")
          .eq("id", itemId)
          .eq("user_id", userId)
          .maybeSingle(),
        getUserSubscription(userId),
        getOrCreateBusinessSettings(userId),
      ]);

    const itemName = itemRow?.name || "An item";

    const businessThreshold = getEffectiveLowStockThreshold(
      subscription,
      businessSettings.low_stock_threshold
    );
    const threshold = getEffectiveItemLowStockThreshold(
      itemRow?.min_stock_level ?? null,
      businessThreshold
    );

    const wasAboveThreshold = quantityBefore > threshold;
    const nowAtOrBelowThreshold = quantityAfter <= threshold;

    if (!wasAboveThreshold || !nowAtOrBelowThreshold) return;

    const linkHref = `/dashboard/inventory/${itemId}`;

    if (quantityAfter <= 0) {
      await createNotification({
        userId,
        type: "out_of_stock",
        title: `${itemName} is out of stock`,
        body: `Quantity dropped to ${quantityAfter}.`,
        itemId,
        linkHref,
      });
      return;
    }

    await createNotification({
      userId,
      type: "low_stock",
      title: `${itemName} is low on stock`,
      body: `Quantity dropped to ${quantityAfter} (threshold: ${threshold}).`,
      itemId,
      linkHref,
    });
  } catch {
    // Silent, by design — see function doc.
  }
}
