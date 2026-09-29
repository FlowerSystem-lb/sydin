import "server-only";

import { getCustomerOverview, logAdminAction } from "@/app/lib/adminAudit";
import { endedEmail, graceStartEmail, renewSoonEmail, sendEmail, type EmailMessage } from "@/app/lib/billingEmails";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

/* The daily billing check (phase 34). For every business on a paid plan with
   an end date:
     7 days or less before the end   -> renew_7d
     ended, inside the 3-day grace   -> grace_start
     grace over (within 10 days)     -> ended
   billing_notifications has a unique key per (account, kind, period end), so
   each reminder goes out once per period even if this runs twice. A reminder
   that fails to send is un-recorded, so tomorrow's run tries again.
   "Won't renew" accounts get no reminders -- only the ended notice. */

const DAY = 86400000;

type Kind = "renew_7d" | "grace_start" | "ended";

export interface BillingRunResult {
  checked: number;
  sent: { email: string; kind: Kind }[];
  skipped: number;
  failed: { email: string; kind: Kind; error: string }[];
}

export async function runBillingReminders(now = Date.now()): Promise<BillingRunResult> {
  const admin = getSupabaseAdmin();
  const customers = await getCustomerOverview();
  const result: BillingRunResult = { checked: 0, sent: [], skipped: 0, failed: [] };

  for (const row of customers) {
    if (row.is_team_member || !row.email || /@[a-z0-9-]+\.sydin\.site$/i.test(row.email)) continue;
    if (!["standard", "pro"].includes(row.plan) || row.status !== "active" || !row.paid_until) continue;
    result.checked += 1;

    const end = Date.parse(row.paid_until);
    let kind: Kind | null = null;
    if (now <= end && end - now <= 7 * DAY) kind = row.cancel_at_period_end ? null : "renew_7d";
    else if (now > end && now <= end + 3 * DAY) kind = row.cancel_at_period_end ? null : "grace_start";
    else if (now > end + 3 * DAY && now <= end + 10 * DAY) kind = "ended";
    if (!kind) {
      result.skipped += 1;
      continue;
    }

    // Claim it first: the unique key means only one run can.
    const { data: claimed, error: claimError } = await admin
      .from("billing_notifications")
      .insert({ user_id: row.user_id, kind, period_end: row.paid_until, email: row.email })
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) {
      result.skipped += 1; // already sent for this period (or table missing)
      continue;
    }

    const business = row.business_name || "there";
    const message: EmailMessage =
      kind === "renew_7d"
        ? renewSoonEmail(row.email, business, row.plan, row.paid_until)
        : kind === "grace_start"
          ? graceStartEmail(row.email, business, row.plan, row.paid_until, new Date(end + 3 * DAY).toISOString())
          : endedEmail(row.email, business, row.plan);

    const sent = await sendEmail(message);
    if (sent.ok) {
      result.sent.push({ email: row.email, kind });
      await logAdminAction(null, `email_${kind}`, row.user_id, { email: row.email, period_end: row.paid_until }).catch(() => undefined);
    } else {
      await admin.from("billing_notifications").delete().eq("id", claimed.id);
      result.failed.push({ email: row.email, kind, error: sent.error ?? "failed" });
    }
  }

  return result;
}
