import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  TeamError,
  authorizeTeamManager,
  errorResponseBody,
  findTeamRow,
  isManagedLogin,
} from "@/app/lib/teamServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Remove someone from the team. A login SydIN created is deleted outright --
    left behind it would still sign in, as an empty workspace of its own. A
    person who joined with their own email keeps their SydIN account. */
export async function POST(request: Request) {
  try {
    const caller = await authorizeTeamManager(request);
    const body = (await request.json().catch(() => ({}))) as { memberRow?: number };
    const row = await findTeamRow(caller, Number(body.memberRow));

    const admin = getSupabaseAdmin();

    if (isManagedLogin(row.email)) {
      const { data: member } = await admin
        .from("business_members")
        .select("member_id")
        .eq("id", row.id)
        .eq("owner_id", caller.businessId)
        .maybeSingle();

      if (member?.member_id) {
        const { error } = await admin.auth.admin.deleteUser(member.member_id);
        if (error) throw new TeamError("Could not remove this login. Please try again.", 500);
      }
      // Deleting the user cascades the membership; this covers a row whose
      // login was never created.
      await admin.from("business_members").delete().eq("id", row.id).eq("owner_id", caller.businessId);
      return NextResponse.json({ ok: true });
    }

    const { error } = await caller.asCaller.rpc("remove_member", { p_member_row: row.id });
    if (error) throw new TeamError(error.message.replace(/^.*?: /, ""), 400);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = errorResponseBody(error);
    return NextResponse.json({ message }, { status });
  }
}
