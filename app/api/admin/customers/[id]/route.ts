import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";
import { getCustomerOverview, logAdminAction } from "@/app/lib/adminAudit";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const ITEM_LIMITS: Record<string, number> = { free: 50, standard: 250, pro: 1000 };
const DAY_MS = 86400000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

async function customerDetail(userId: string) {
  const admin = getSupabaseAdmin();
  const overview = (await getCustomerOverview()).find((row) => row.user_id === userId) ?? null;
  if (!overview) return null;
  const [payments, notes, log] = await Promise.all([
    admin
      .from("subscription_payments")
      .select("id, plan, billing_cycle, months, amount, currency, method, reference, note, period_start, period_end, paid_at")
      .eq("user_id", userId)
      .order("paid_at", { ascending: false }),
    admin.from("admin_customer_notes").select("id, note, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    admin
      .from("admin_audit_log")
      .select("id, action, details, created_at")
      .eq("target_user", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  return {
    customer: overview,
    payments: payments.data ?? [],
    notes: notes.data ?? [],
    log: log.data ?? [],
  };
}

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) return json({ error: authorization.message, code: authorization.code }, authorization.status);
  const { id } = await params;
  try {
    const detail = await customerDetail(id);
    if (!detail) return json({ error: "No account with that id." }, 404);
    return json(detail);
  } catch (error) {
    console.error("Admin customer failed:", error instanceof Error ? error.message : error);
    return json({ error: "Could not load this customer." }, 500);
  }
}

/* Actions on one account. Every one is written to the audit log. Nothing
   here deletes data: cancelling drops the account to Free limits, the same
   as an unpaid plan after its grace. */
export async function POST(request: Request, { params }: Params) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) return json({ error: authorization.message, code: authorization.code }, authorization.status);
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");
  const admin = getSupabaseAdmin();
  const now = new Date();

  try {
    const { data: sub } = await admin
      .from("user_subscriptions")
      .select("plan, status, paid_until")
      .eq("user_id", id)
      .maybeSingle();
    const { data: userCheck } = await admin.auth.admin.getUserById(id);
    if (!userCheck?.user) return json({ error: "No account with that id." }, 404);

    let details: Record<string, unknown> = {};

    if (action === "extend") {
      const days = Math.round(Number(body.days));
      if (!Number.isFinite(days) || days < 1 || days > 365) return json({ error: "Days must be 1 to 365." }, 400);
      if (!sub || !["standard", "pro"].includes(String(sub.plan))) return json({ error: "Extend works on a paid plan. Record a payment or change the plan first." }, 400);
      if (!sub.paid_until) return json({ error: "This plan has no end date, so there is nothing to extend." }, 400);
      const end = Date.parse(sub.paid_until);
      const base = end > now.getTime() ? end : now.getTime();
      const paidUntil = new Date(base + days * DAY_MS).toISOString();
      const { error } = await admin.from("user_subscriptions").update({ paid_until: paidUntil, status: "active", updated_at: now.toISOString() }).eq("user_id", id);
      if (error) throw error;
      details = { days, from: sub.paid_until, to: paidUntil };
    } else if (action === "change_plan") {
      const plan = String(body.plan || "");
      if (!["free", "standard", "pro"].includes(plan)) return json({ error: "Choose Free, Standard or Pro." }, 400);
      const { error } = await admin.from("user_subscriptions").upsert(
        {
          user_id: id,
          plan,
          item_limit: ITEM_LIMITS[plan],
          status: "active",
          updated_at: now.toISOString(),
          ...(plan === "free" ? { paid_until: null, billing_cycle: null, cancel_at_period_end: false } : {}),
          ...(sub ? {} : { activated_at: now.toISOString() }),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      details = { from: sub?.plan ?? "free", to: plan };
    } else if (action === "cancel_now") {
      if (!sub) return json({ error: "This account has no plan to cancel." }, 400);
      const { error } = await admin
        .from("user_subscriptions")
        .update({ status: "cancelled", cancelled_at: now.toISOString(), cancel_at_period_end: false, updated_at: now.toISOString() })
        .eq("user_id", id);
      if (error) throw error;
      details = { plan: sub.plan, paid_until: sub.paid_until };
    } else if (action === "stop_renewal") {
      const on = Boolean(body.on);
      const { error } = await admin.from("user_subscriptions").update({ cancel_at_period_end: on, updated_at: now.toISOString() }).eq("user_id", id);
      if (error) throw error;
      details = { on };
    } else if (action === "reactivate") {
      if (!sub) return json({ error: "This account has no plan to turn back on." }, 400);
      const { error } = await admin
        .from("user_subscriptions")
        .update({ status: "active", cancelled_at: null, updated_at: now.toISOString() })
        .eq("user_id", id);
      if (error) throw error;
      details = { plan: sub.plan };
    } else if (action === "remove_end_date") {
      if (!sub || !["standard", "pro"].includes(String(sub.plan))) return json({ error: "Only a paid plan can run with no end date." }, 400);
      const { error } = await admin
        .from("user_subscriptions")
        .update({ paid_until: null, status: "active", updated_at: now.toISOString() })
        .eq("user_id", id);
      if (error) throw error;
      details = { was: sub.paid_until };
    } else if (action === "note") {
      const note = String(body.note || "").trim().slice(0, 2000);
      if (!note) return json({ error: "Write a note first." }, 400);
      const { error } = await admin.from("admin_customer_notes").insert({ user_id: id, admin_id: authorization.user.id, note });
      if (error) throw error;
      details = { length: note.length };
    } else {
      return json({ error: "Unknown action." }, 400);
    }

    await logAdminAction(authorization.user.id, action, id, details);
    return json(await customerDetail(id));
  } catch (error) {
    console.error("Admin customer action failed:", error instanceof Error ? error.message : error);
    return json({ error: "That didn't work. Nothing was changed." }, 500);
  }
}
