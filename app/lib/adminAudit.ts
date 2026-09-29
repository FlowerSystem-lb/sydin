import "server-only";

import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

/* Every admin action is written to admin_audit_log (sql/phase-33-admin.sql):
   who did it, what, to which account, when. Best effort: a missing table
   (before phase 33) or a failed write never blocks the action itself. */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetUser: string | null,
  details: Record<string, unknown> = {}
) {
  try {
    await getSupabaseAdmin().from("admin_audit_log").insert({
      admin_id: adminId,
      action: action.slice(0, 60),
      target_user: targetUser,
      details,
    });
  } catch {
    /* never block the admin action on the log */
  }
}

export interface CustomerOverviewRow {
  user_id: string;
  email: string | null;
  signed_up: string;
  last_sign_in: string | null;
  business_name: string | null;
  phone: string | null;
  plan: string;
  status: string;
  paid_until: string | null;
  billing_cycle: string | null;
  cancel_at_period_end: boolean;
  effective_plan: "free" | "standard" | "pro";
  last_paid_at: string | null;
  total_paid: number;
  items: number;
  members: number;
  is_team_member: boolean;
}

export async function getCustomerOverview(): Promise<CustomerOverviewRow[]> {
  const { data, error } = await getSupabaseAdmin().rpc("admin_customer_overview");
  if (error) throw error;
  return ((data || []) as CustomerOverviewRow[]).map((row) => ({
    ...row,
    total_paid: Number(row.total_paid) || 0,
    items: Number(row.items) || 0,
    members: Number(row.members) || 0,
  }));
}
