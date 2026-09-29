import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";
import { getCustomerOverview, logAdminAction } from "@/app/lib/adminAudit";
import { emailConfigured, sendEmail, testEmail } from "@/app/lib/billingEmails";
import { runBillingReminders } from "@/app/lib/billingJob";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Admin > Emails: is sending connected, what was sent, test, run now. */
export async function GET(request: Request) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) {
    return NextResponse.json({ error: authorization.message, code: authorization.code }, { status: authorization.status, headers: NO_STORE });
  }
  const [{ data: sent }, customers] = await Promise.all([
    getSupabaseAdmin()
      .from("billing_notifications")
      .select("id, user_id, kind, period_end, email, sent_at")
      .order("sent_at", { ascending: false })
      .limit(100),
    getCustomerOverview().catch(() => []),
  ]);
  const names = new Map(customers.map((row) => [row.user_id, row.business_name]));
  return NextResponse.json(
    {
      configured: { email: emailConfigured(), schedule: Boolean(process.env.CRON_SECRET) },
      sent: (sent ?? []).map((row) => ({ ...row, business: names.get(row.user_id) ?? null })),
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: Request) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) {
    return NextResponse.json({ error: authorization.message, code: authorization.code }, { status: authorization.status, headers: NO_STORE });
  }
  const body = (await request.json().catch(() => ({}))) as { action?: string };

  if (body.action === "test") {
    const to = authorization.user.email;
    if (!to) return NextResponse.json({ error: "Your admin login has no email." }, { status: 400, headers: NO_STORE });
    const sent = await sendEmail(testEmail(to));
    if (!sent.ok) return NextResponse.json({ error: `Not sent: ${sent.error}` }, { status: 502, headers: NO_STORE });
    await logAdminAction(authorization.user.id, "email_test", null, { to });
    return NextResponse.json({ message: `Test sent to ${to}.` }, { headers: NO_STORE });
  }

  if (body.action === "run") {
    try {
      const result = await runBillingReminders();
      await logAdminAction(authorization.user.id, "email_run", null, {
        checked: result.checked,
        sent: result.sent.length,
        failed: result.failed.length,
      });
      return NextResponse.json({ result }, { headers: NO_STORE });
    } catch (error) {
      console.error("Manual billing run failed:", error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "The check failed." }, { status: 500, headers: NO_STORE });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400, headers: NO_STORE });
}
