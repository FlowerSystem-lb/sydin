import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";
import { isManagedLogin } from "@/app/lib/teamServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Delete my account (Settings > Account, 29 Sep 2026).
 *
 * Only a business OWNER deletes, and only their own business: a team member
 * leaves instead. Guards: the caller's own token, the typed word DELETE, and
 * a sign-in in the last 24 hours (a session left open on a shared computer
 * is not enough to wipe a business).
 *
 * Order matters. Almost every table cascades from auth.users, but two do
 * not: inventory has no link to the user, and a stock transfer RESTRICTs its
 * item. So: transfers, then items (their history, movements and assets
 * cascade), then the files in storage, then the logins SydIN made for the
 * team, then the owner's user -- which cascades everything else. */

const BUCKETS = ["products", "business-logos", "po-attachments"];
const RECENT_SIGN_IN_MS = 24 * 60 * 60 * 1000;

function fail(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

async function listFilesUnder(bucket: string, prefix: string): Promise<string[]> {
  const storage = getSupabaseAdmin().storage.from(bucket);
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error || !data) return paths;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      // A folder has no id; walk into it.
      if (entry.id === null) paths.push(...(await listFilesUnder(bucket, path)));
      else paths.push(path);
    }
    if (data.length < 1000) return paths;
  }
}

export async function POST(request: Request) {
  const [scheme, token] = (request.headers.get("authorization") || "").trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return fail("Please sign in again.", 401);

  const body = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "DELETE") return fail("Type DELETE to confirm.", 400);

  const admin = getSupabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return fail("Your session could not be verified.", 401);

  const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  if (!lastSignIn || Date.now() - lastSignIn > RECENT_SIGN_IN_MS) {
    return fail("For your safety, sign out and sign in again, then delete.", 403);
  }

  const asCaller = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
  const { data: business, error: businessError } = await asCaller.rpc("my_business");
  if (businessError || !business) return fail("Could not load your business.", 500);
  if (business.role !== "owner" || business.business_id !== user.id) {
    return fail("Only the owner can delete the business. Use Leave business instead.", 403);
  }

  const ownerId = user.id;

  try {
    // 1-2. The two tables that do not cascade from the user.
    const transfers = await admin.from("inventory_depot_transfers").delete().eq("user_id", ownerId);
    if (transfers.error) throw transfers.error;
    const items = await admin.from("inventory").delete().eq("user_id", ownerId);
    if (items.error) throw items.error;
    // A plan request only nulls its user; it is theirs, so it goes too.
    await admin.from("plan_requests").delete().eq("user_id", ownerId);

    // 3. Photos, logos and PO attachments, all kept under the business folder.
    for (const bucket of BUCKETS) {
      const paths = await listFilesUnder(bucket, ownerId);
      for (let index = 0; index < paths.length; index += 100) {
        await admin.storage.from(bucket).remove(paths.slice(index, index + 100));
      }
    }

    // 4. Logins SydIN made for this business exist only for it.
    const { data: members } = await admin
      .from("business_members")
      .select("member_id, email")
      .eq("owner_id", ownerId);
    for (const member of members || []) {
      if (member.member_id && isManagedLogin(member.email)) {
        await admin.auth.admin.deleteUser(member.member_id);
      }
    }

    // 5. The owner. Everything else cascades from here.
    const { error: deleteError } = await admin.auth.admin.deleteUser(ownerId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account delete failed:", error instanceof Error ? error.message : error);
    return fail("Deleting stopped part way. Please try again to finish.", 500);
  }
}
