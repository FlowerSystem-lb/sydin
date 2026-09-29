import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";
import { logAdminAction } from "@/app/lib/adminAudit";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* One plan request (admin). 30 Sep 2026: besides mark paid / reject, the
   console can edit a request, reopen it, mark it started once the plan is
   turned on (via Record a payment), and delete it. Every change is logged. */

type RequestAction = "mark_paid" | "reject" | "reopen" | "mark_activated" | "edit";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const NO_STORE = { "Cache-Control": "private, no-store" };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

function isRequestAction(value: unknown): value is RequestAction {
  return ["mark_paid", "reject", "reopen", "mark_activated", "edit"].includes(String(value));
}

function text(value: unknown, max: number) {
  const cleaned = typeof value === "string" ? value.trim().slice(0, max) : "";
  return cleaned || null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeAdminRequest(request);

  if (!authorization.authorized) {
    return jsonError(authorization.message, authorization.status);
  }

  const { id } = await context.params;
  const requestId = decodeURIComponent(id || "").trim();

  if (!requestId) {
    return jsonError("A valid plan request ID is required.", 400);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;

  if (!body || !isRequestAction(action)) {
    return jsonError("Unsupported plan request action.", 400);
  }

  const now = new Date().toISOString();
  let allowedStatuses: string[];
  let update: Record<string, unknown>;

  if (action === "mark_paid") {
    allowedStatuses = ["pending"];
    update = { status: "paid", paid_at: now, reviewed_by: authorization.user.id, reviewed_at: now };
  } else if (action === "reject") {
    allowedStatuses = ["pending", "paid"];
    update = { status: "rejected", reviewed_by: authorization.user.id, reviewed_at: now };
  } else if (action === "reopen") {
    allowedStatuses = ["rejected"];
    update = { status: "pending", reviewed_by: authorization.user.id, reviewed_at: now };
  } else if (action === "mark_activated") {
    allowedStatuses = ["pending", "paid"];
    update = {
      status: "activated",
      activated_at: now,
      paid_at: text(body.paid_at, 40) ?? now,
      user_id: text(body.user_id, 40),
      reviewed_by: authorization.user.id,
      reviewed_at: now,
    };
  } else {
    allowedStatuses = ["pending", "paid", "activated", "rejected"];
    const plan = String(body.selected_plan || "");
    update = {
      admin_notes: text(body.admin_notes, 2000),
      ...(["Standard", "Pro"].includes(plan) ? { selected_plan: plan } : {}),
      ...(typeof body.phone === "string" ? { phone: text(body.phone, 40) } : {}),
      ...(typeof body.business_name === "string" ? { business_name: text(body.business_name, 120) } : {}),
    };
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("plan_requests")
      .update(update)
      .eq("id", requestId)
      .in("status", allowedStatuses)
      .select("id, status, paid_at, reviewed_at, activated_at, admin_notes, selected_plan")
      .maybeSingle();

    if (error) {
      console.error("Admin plan request update failed:", error.message);
      return jsonError("The plan request could not be updated.", 500);
    }

    if (!data) {
      return jsonError(
        action === "mark_paid"
          ? "Only pending requests can be marked paid."
          : action === "reopen"
            ? "Only rejected requests can be reopened."
            : "This request can't be changed in its current state.",
        409
      );
    }

    await logAdminAction(authorization.user.id, `request_${action}`, text(body.user_id, 40), { requestId });

    return NextResponse.json({ request: data }, { headers: NO_STORE });
  } catch {
    return jsonError("The plan request is temporarily unavailable.", 500);
  }
}

/** Delete a request for good (spam, duplicates, tests). The customer's
    account and plan are not touched. */
export async function DELETE(request: Request, context: RouteContext) {
  const authorization = await authorizeAdminRequest(request);
  if (!authorization.authorized) {
    return jsonError(authorization.message, authorization.status);
  }

  const { id } = await context.params;
  const requestId = decodeURIComponent(id || "").trim();
  if (!requestId) return jsonError("A valid plan request ID is required.", 400);

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("plan_requests")
      .delete()
      .eq("id", requestId)
      .select("id, email, selected_plan, status")
      .maybeSingle();
    if (error) {
      console.error("Admin plan request delete failed:", error.message);
      return jsonError("The plan request could not be deleted.", 500);
    }
    if (!data) return jsonError("Plan request not found.", 404);
    await logAdminAction(authorization.user.id, "request_delete", null, {
      requestId,
      email: data.email,
      plan: data.selected_plan,
      status: data.status,
    });
    return NextResponse.json({ deleted: true }, { headers: NO_STORE });
  } catch {
    return jsonError("The plan request is temporarily unavailable.", 500);
  }
}
