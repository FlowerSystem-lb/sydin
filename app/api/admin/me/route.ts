import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* "Is this login a SydIN admin?" -- for showing the Admin link and the
   authenticator-code screen. Deliberately answers only true/false: a
   non-admin learns nothing about who the admins are. The code itself is not
   required here (that is the point of asking); every admin DATA route still
   requires it (app/lib/adminAuth.ts). */
export async function GET(request: Request) {
  const authorization = await authorizeAdminRequest(request, { requireMfa: false });
  return NextResponse.json(
    { admin: authorization.authorized },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
