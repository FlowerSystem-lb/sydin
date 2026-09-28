import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  TeamError,
  authorizeTeamManager,
  errorResponseBody,
  findTeamRow,
  generatePassword,
  isManagedLogin,
} from "@/app/lib/teamServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** New password for a login SydIN created. Those addresses cannot receive
    email, so "forgot password" goes through the owner or an admin. */
export async function POST(request: Request) {
  try {
    const caller = await authorizeTeamManager(request);
    const body = (await request.json().catch(() => ({}))) as { memberRow?: number };
    const row = await findTeamRow(caller, Number(body.memberRow));

    if (!isManagedLogin(row.email)) {
      throw new TeamError("This person signs in with their own email and can reset it from the login page.", 400);
    }

    const admin = getSupabaseAdmin();
    const { data: member } = await admin
      .from("business_members")
      .select("member_id")
      .eq("id", row.id)
      .eq("owner_id", caller.businessId)
      .maybeSingle();
    if (!member?.member_id) throw new TeamError("Team member not found.", 404);

    const password = generatePassword();
    const { error } = await admin.auth.admin.updateUserById(member.member_id, { password });
    if (error) throw new TeamError("Could not reset the password. Please try again.", 500);

    return NextResponse.json({ email: row.email, password });
  } catch (error) {
    const { status, message } = errorResponseBody(error);
    return NextResponse.json({ message }, { status });
  }
}
