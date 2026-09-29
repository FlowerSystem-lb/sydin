import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";
import { getCustomerOverview } from "@/app/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Admin > Customers: one row per SydIN account. */
export async function GET(request: Request) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) {
    return NextResponse.json({ error: authorization.message, code: authorization.code }, { status: authorization.status, headers: NO_STORE });
  }
  try {
    return NextResponse.json({ customers: await getCustomerOverview() }, { headers: NO_STORE });
  } catch (error) {
    console.error("Admin customers failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load customers." }, { status: 500, headers: NO_STORE });
  }
}
