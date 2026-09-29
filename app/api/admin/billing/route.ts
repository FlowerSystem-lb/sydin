import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Manual payments (phase 32, 29 Sep 2026).
 *
 * A customer pays by Whish / OMT / crypto and tells Sayed on WhatsApp. Here,
 * from /admin, Sayed looks the account up by email and records the payment:
 * record_subscription_payment() (sql/phase-32-billing.sql) writes it to the
 * history and moves the paid period forward in one step, so access is on at
 * once. Admin only (SYDIN_ADMIN_USER_IDS), service role only on the server. */

const NO_STORE = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function findUserByEmail(email: string): Promise<User | null> {
  const admin = getSupabaseAdmin();
  const wanted = normalizeEmail(email);
  if (!wanted) return null;
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => normalizeEmail(user.email) === wanted);
    if (match) return match;
    if (page >= data.lastPage || data.users.length < perPage) return null;
  }
  return null;
}

async function accountSummary(user: User) {
  const admin = getSupabaseAdmin();
  const [{ data: subscription }, { data: payments }, { data: settings }] = await Promise.all([
    admin
      .from("user_subscriptions")
      .select("plan, status, paid_until, billing_cycle, activated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("subscription_payments")
      .select("id, plan, billing_cycle, months, amount, currency, method, reference, period_start, period_end, paid_at")
      .eq("user_id", user.id)
      .order("paid_at", { ascending: false })
      .limit(20),
    admin.from("business_settings").select("business_name").eq("user_id", user.id).maybeSingle(),
  ]);
  return {
    user: { id: user.id, email: user.email },
    businessName: settings?.business_name ?? null,
    subscription: subscription ?? null,
    payments: payments ?? [],
  };
}

export async function GET(request: Request) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) return json({ error: authorization.message }, authorization.status);

  const email = new URL(request.url).searchParams.get("email");
  try {
    const user = await findUserByEmail(email || "");
    if (!user) return json({ error: "No SydIN account uses that email." }, 404);
    return json(await accountSummary(user));
  } catch (error) {
    console.error("Admin billing lookup failed:", error instanceof Error ? error.message : error);
    return json({ error: "Could not look that account up." }, 500);
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) return json({ error: authorization.message }, authorization.status);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const plan = String(body.plan || "");
  const cycle = String(body.cycle || "");
  const months = Math.round(Number(body.months));
  const amount = Number(body.amount);
  const currency = String(body.currency || "USD").trim().toUpperCase();

  if (!["standard", "pro"].includes(plan)) return json({ error: "Choose Standard or Pro." }, 400);
  if (!["monthly", "yearly"].includes(cycle)) return json({ error: "Choose monthly or yearly." }, 400);
  if (!Number.isFinite(months) || months < 1 || months > 24) return json({ error: "Months must be 1 to 24." }, 400);
  if (!Number.isFinite(amount) || amount < 0) return json({ error: "Enter the amount paid." }, 400);
  if (!/^[A-Z]{3}$/.test(currency)) return json({ error: "Currency must be a 3-letter code." }, 400);

  try {
    const user = await findUserByEmail(String(body.email || ""));
    if (!user) return json({ error: "No SydIN account uses that email." }, 404);

    const { error } = await getSupabaseAdmin().rpc("record_subscription_payment", {
      p_user: user.id,
      p_plan: plan,
      p_cycle: cycle,
      p_months: months,
      p_amount: amount,
      p_currency: currency,
      p_method: String(body.method || "").slice(0, 40) || null,
      p_reference: String(body.reference || "").slice(0, 120) || null,
      p_note: String(body.note || "").slice(0, 500) || null,
      p_recorded_by: authorization.user.id,
    });
    if (error) {
      console.error("Admin record payment failed:", error.message);
      return json({ error: "The payment could not be recorded. Nothing was changed." }, 500);
    }
    return json(await accountSummary(user));
  } catch (error) {
    console.error("Admin record payment failed:", error instanceof Error ? error.message : error);
    return json({ error: "The payment could not be recorded." }, 500);
  }
}
