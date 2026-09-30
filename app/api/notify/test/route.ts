import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sendEmail, testEmail } from "@/app/lib/billingEmails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Settings > Notifications > "Send a test email": to the signed-in person's
   own address only, so it can't be used to mail anyone else. */
export async function POST(request: Request) {
  const [scheme, token] = (request.headers.get("authorization") || "").trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return NextResponse.json({ sent: false }, { status: 401 });
  const { data } = await getSupabaseAdmin().auth.getUser(token);
  const email = data?.user?.email;
  if (!email) return NextResponse.json({ sent: false }, { status: 401 });
  const sent = await sendEmail(testEmail(email));
  return NextResponse.json({ sent: sent.ok }, { status: sent.ok ? 200 : 502 });
}
