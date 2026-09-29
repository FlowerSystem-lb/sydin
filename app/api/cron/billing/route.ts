import { NextResponse } from "next/server";
import { runBillingReminders } from "@/app/lib/billingJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Daily at 06:00 UTC (09:00 Beirut), from vercel.json. Vercel sends
   "Authorization: Bearer <CRON_SECRET>"; anything else is refused, so a
   stranger can't make SydIN send emails. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  try {
    const result = await runBillingReminders();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Billing cron failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Billing check failed." }, { status: 500 });
  }
}
