import "server-only";

import { lowStockEmail, sendEmail, weeklySummaryEmail } from "@/app/lib/billingEmails";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

/* Owner notifications (phase 35), run by the same daily job as billing:
 *   - low stock: when an owner has "Low-stock alert" on and items are at or
 *     below their level. Once per day at most, and only when the list of low
 *     items changed since the last alert (no daily repeat of the same list).
 *   - weekly summary: Mondays, for owners with "Weekly summary" on.
 * Preferences live on the owner's login (user_metadata.notify_low_stock /
 * notify_weekly, set in Settings > My profile). billing_notifications' unique
 * key makes each email go once per day / week even if the job runs twice. */

const FREE_THRESHOLD = 10;
const DAY = 86400000;

export interface NotificationRunResult {
  lowStock: number;
  weekly: number;
  failed: string[];
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function runOwnerNotifications(now = new Date()): Promise<NotificationRunResult> {
  const admin = getSupabaseAdmin();
  const result: NotificationRunResult = { lowStock: 0, weekly: 0, failed: [] };

  // Who asked for emails (owners only -- team logins are skipped).
  const wanting: { id: string; email: string; lowStock: boolean; weekly: boolean }[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const user of data.users) {
      const meta = user.user_metadata || {};
      if (!user.email || /@[a-z0-9-]+\.sydin\.site$/i.test(user.email)) continue;
      if (meta.notify_low_stock || meta.notify_weekly) {
        wanting.push({ id: user.id, email: user.email, lowStock: Boolean(meta.notify_low_stock), weekly: Boolean(meta.notify_weekly) });
      }
    }
    if (page >= data.lastPage || data.users.length < 1000) break;
  }
  if (wanting.length === 0) return result;

  const { data: members } = await admin.from("business_members").select("member_id").eq("status", "active");
  const memberIds = new Set((members ?? []).map((row) => row.member_id));

  const today = startOfUtcDay(now);
  const isMonday = now.getUTCDay() === 1;

  for (const owner of wanting) {
    if (memberIds.has(owner.id)) continue;

    const [{ data: settings }, { data: sub }, { data: items }] = await Promise.all([
      admin.from("business_settings").select("business_name, low_stock_threshold, currency_code").eq("user_id", owner.id).maybeSingle(),
      admin.from("user_subscriptions").select("plan, status, paid_until").eq("user_id", owner.id).maybeSingle(),
      admin.from("inventory").select("id, name, quantity, min_stock_level, unit_type, custom_unit_label").eq("user_id", owner.id).limit(5000),
    ]);
    const business = settings?.business_name || "your business";
    const paid =
      sub &&
      String(sub.status).toLowerCase() === "active" &&
      ["standard", "pro"].includes(String(sub.plan).toLowerCase()) &&
      (!sub.paid_until || now.getTime() <= Date.parse(sub.paid_until) + 3 * DAY);
    const fallback = paid && Number.isFinite(Number(settings?.low_stock_threshold)) ? Number(settings?.low_stock_threshold) : FREE_THRESHOLD;

    const low = (items ?? [])
      .map((item) => {
        const threshold =
          typeof item.min_stock_level === "number" && item.min_stock_level >= 0 ? item.min_stock_level : fallback;
        return {
          id: item.id as number,
          name: String(item.name || "Item"),
          quantity: Number(item.quantity) || 0,
          threshold,
          unit: item.unit_type === "custom" ? String(item.custom_unit_label || "") : String(item.unit_type || "pcs"),
        };
      })
      .filter((item) => item.quantity <= item.threshold)
      .sort((a, b) => a.quantity - b.quantity);

    // ---- low stock
    if (owner.lowStock && low.length > 0) {
      const detail = low.map((item) => item.id).sort((a, b) => a - b).join(",").slice(0, 2000);
      const { data: last } = await admin
        .from("billing_notifications")
        .select("detail")
        .eq("user_id", owner.id)
        .eq("kind", "low_stock")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.detail !== detail) {
        const { data: claimed } = await admin
          .from("billing_notifications")
          .insert({ user_id: owner.id, kind: "low_stock", period_end: today.toISOString(), email: owner.email, detail })
          .select("id")
          .maybeSingle();
        if (claimed) {
          const sent = await sendEmail(lowStockEmail(owner.email, business, low, low.length));
          if (sent.ok) result.lowStock += 1;
          else {
            await admin.from("billing_notifications").delete().eq("id", claimed.id);
            result.failed.push(`low_stock ${owner.email}: ${sent.error}`);
          }
        }
      }
    }

    // ---- weekly summary (Mondays)
    if (owner.weekly && isMonday) {
      const from = new Date(today.getTime() - 7 * DAY);
      const { data: claimed } = await admin
        .from("billing_notifications")
        .insert({ user_id: owner.id, kind: "weekly_summary", period_end: today.toISOString(), email: owner.email })
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      const [{ data: orders }, { data: payments }] = await Promise.all([
        admin
          .from("sales_orders")
          .select("id, status, issue_date, amount_paid, tax_rate, prices_include_tax, sales_order_lines(quantity, unit_price)")
          .eq("user_id", owner.id)
          .in("status", ["issued", "paid"]),
        admin
          .from("sales_order_payments")
          .select("amount, paid_at")
          .eq("user_id", owner.id)
          .gte("paid_at", from.toISOString()),
      ]);

      let invoices = 0;
      let sold = 0;
      let owed = 0;
      for (const order of orders ?? []) {
        const lines = (order.sales_order_lines ?? []) as { quantity: number; unit_price: number | null }[];
        const subtotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0), 0);
        const rate = Number(order.tax_rate) || 0;
        const total = rate > 0 && !order.prices_include_tax ? subtotal + Math.round(subtotal * rate) / 100 : subtotal;
        owed += Math.max(0, total - (Number(order.amount_paid) || 0));
        if (order.issue_date && Date.parse(order.issue_date) >= from.getTime()) {
          invoices += 1;
          sold += total;
        }
      }
      const received = (payments ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

      const sent = await sendEmail(
        weeklySummaryEmail(owner.email, business, settings?.currency_code || "USD", {
          invoices,
          sold,
          received,
          owed,
          lowItems: low.length,
          from: from.toISOString(),
          to: new Date(today.getTime() - DAY).toISOString(),
        })
      );
      if (sent.ok) result.weekly += 1;
      else {
        await admin.from("billing_notifications").delete().eq("id", claimed.id);
        result.failed.push(`weekly ${owner.email}: ${sent.error}`);
      }
    }
  }

  return result;
}
