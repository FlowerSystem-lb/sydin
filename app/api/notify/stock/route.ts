import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { itemAlertEmail, sendEmail } from "@/app/lib/billingEmails";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Instant stock alert email (phase 36, 30 Sep 2026: Sayed dropped an item
   below its level and expected an email right away).
 *
 * The app already writes a bell notification at the exact moment an item
 * CROSSES into low / out of stock (notifyIfCrossedIntoLowStock). Right after,
 * it calls this route with that notification's id. Here: the caller's own
 * token reads the notification (RLS proves it belongs to their business),
 * the business owner's preference decides (Settings > Notifications), and the
 * email goes to the owner -- also when a team member made the change. Only
 * crossings create notifications, so an item that stays low never repeats. */

export async function POST(request: Request) {
  const [scheme, token] = (request.headers.get("authorization") || "").trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return NextResponse.json({ sent: false }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { notificationId?: number };
  const notificationId = Number(body.notificationId);
  if (!Number.isFinite(notificationId)) return NextResponse.json({ sent: false }, { status: 400 });

  const asCaller = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: note } = await asCaller
    .from("notifications")
    .select("id, user_id, type, item_id, created_at")
    .eq("id", notificationId)
    .maybeSingle();
  if (!note || !note.item_id || !["low_stock", "out_of_stock"].includes(note.type)) {
    return NextResponse.json({ sent: false });
  }
  // Only fresh events: an old id replayed can't send mail.
  if (Date.now() - Date.parse(note.created_at) > 5 * 60 * 1000) return NextResponse.json({ sent: false });

  const admin = getSupabaseAdmin();
  const { data: ownerData } = await admin.auth.admin.getUserById(note.user_id);
  const owner = ownerData?.user;
  const meta = owner?.user_metadata || {};
  const wants = note.type === "out_of_stock" ? meta.notify_item_out : meta.notify_item_low;
  if (!owner?.email || !wants) return NextResponse.json({ sent: false });

  const [{ data: item }, { data: settings }] = await Promise.all([
    admin.from("inventory").select("id, name, quantity, min_stock_level").eq("id", note.item_id).eq("user_id", note.user_id).maybeSingle(),
    admin.from("business_settings").select("business_name, low_stock_threshold").eq("user_id", note.user_id).maybeSingle(),
  ]);
  if (!item) return NextResponse.json({ sent: false });

  const threshold =
    typeof item.min_stock_level === "number" && item.min_stock_level >= 0
      ? item.min_stock_level
      : Number.isFinite(Number(settings?.low_stock_threshold))
        ? Number(settings?.low_stock_threshold)
        : null;

  const sent = await sendEmail(
    itemAlertEmail(owner.email, settings?.business_name || "your business", {
      id: item.id,
      name: String(item.name || "An item"),
      quantity: Number(item.quantity) || 0,
      threshold,
      out: note.type === "out_of_stock",
    })
  );
  return NextResponse.json({ sent: sent.ok });
}
