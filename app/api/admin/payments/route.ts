import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";
import { getCustomerOverview } from "@/app/lib/adminAudit";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Admin > Payments (every recorded payment) and Admin > Activity (the log). */
export async function GET(request: Request) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) {
    return NextResponse.json({ error: authorization.message, code: authorization.code }, { status: authorization.status, headers: NO_STORE });
  }
  try {
    const admin = getSupabaseAdmin();
    const [payments, log, customers] = await Promise.all([
      admin
        .from("subscription_payments")
        .select("id, user_id, plan, billing_cycle, months, amount, currency, method, reference, period_start, period_end, paid_at")
        .order("paid_at", { ascending: false })
        .limit(1000),
      admin.from("admin_audit_log").select("id, admin_id, action, target_user, details, created_at").order("created_at", { ascending: false }).limit(300),
      getCustomerOverview(),
    ]);
    const names = new Map(customers.map((row) => [row.user_id, { email: row.email, business: row.business_name }]));
    return NextResponse.json(
      {
        payments: (payments.data ?? []).map((row) => ({ ...row, amount: Number(row.amount), customer: names.get(row.user_id) ?? null })),
        log: (log.data ?? []).map((row) => ({
          ...row,
          admin: row.admin_id ? names.get(row.admin_id)?.email ?? null : null,
          customer: row.target_user ? names.get(row.target_user) ?? null : null,
        })),
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("Admin payments failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load payments." }, { status: 500, headers: NO_STORE });
  }
}
