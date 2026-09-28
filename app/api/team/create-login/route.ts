import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  TeamError,
  authorizeTeamManager,
  errorResponseBody,
  generatePassword,
  managedLoginEmail,
} from "@/app/lib/teamServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "admin" | "staff" | "viewer";

/** Owner/admin types a name and a role; SydIN creates the login and returns
    the address and password once. See app/lib/teamServer.ts. */
export async function POST(request: Request) {
  try {
    const caller = await authorizeTeamManager(request);
    const body = (await request.json().catch(() => ({}))) as { name?: string; role?: string };

    const name = String(body.name ?? "").trim().slice(0, 60);
    const role = body.role as Role;
    if (!name) throw new TeamError("Type the person's name.", 400);
    if (!["admin", "staff", "viewer"].includes(role)) {
      throw new TeamError("Choose Admin, Staff or View only.", 400);
    }

    const admin = getSupabaseAdmin();
    const businessName = caller.businessName || "team";

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const email = managedLoginEmail(name, role, businessName, attempt);

      // Taken by any business already? Try ahmed2, ahmed3... invite_member
      // would otherwise just change the role of an existing row.
      const { data: taken } = await admin
        .from("business_members")
        .select("id")
        .eq("email", email)
        .limit(1);
      if (taken && taken.length > 0) continue;

      // As the caller, so the database checks their role and the seat limit.
      const { data: invited, error: inviteError } = await caller.asCaller.rpc("invite_member", {
        p_email: email,
        p_role: role,
      });
      if (inviteError || !invited) {
        throw new TeamError(inviteError?.message.replace(/^.*?: /, "") || "Could not add this person.", 400);
      }

      const password = generatePassword();
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, managed_by_business: caller.businessId },
      });

      if (createError || !created.user) {
        await admin.from("business_members").delete().eq("id", invited.id);
        if (/already|exists|registered/i.test(createError?.message ?? "")) continue;
        throw new TeamError("Could not create the login. Please try again.", 500);
      }

      const { error: linkError } = await admin
        .from("business_members")
        .update({ member_id: created.user.id, status: "active", accepted_at: new Date().toISOString() })
        .eq("id", invited.id);

      if (linkError) {
        await admin.auth.admin.deleteUser(created.user.id);
        await admin.from("business_members").delete().eq("id", invited.id);
        throw new TeamError("Could not finish creating the login. Please try again.", 500);
      }

      return NextResponse.json({ email, password, name });
    }

    throw new TeamError("Too many people with that name. Add a surname.", 409);
  } catch (error) {
    const { status, message } = errorResponseBody(error);
    return NextResponse.json({ message }, { status });
  }
}
