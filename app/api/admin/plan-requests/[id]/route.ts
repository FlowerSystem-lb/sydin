import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestAction = "mark_paid" | "reject";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}

function isRequestAction(value: unknown): value is RequestAction {
  return value === "mark_paid" || value === "reject";
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("A valid request action is required.", 400);
  }

  const action =
    typeof body === "object" && body !== null && "action" in body
      ? (body as { action?: unknown }).action
      : null;

  if (!isRequestAction(action)) {
    return jsonError("Unsupported plan request action.", 400);
  }

  const allowedStatuses = action === "mark_paid" ? ["pending"] : ["pending", "paid"];
  const now = new Date().toISOString();
  const update =
    action === "mark_paid"
      ? {
          status: "paid",
          paid_at: now,
          reviewed_by: authorization.user.id,
          reviewed_at: now,
        }
      : {
          status: "rejected",
          reviewed_by: authorization.user.id,
          reviewed_at: now,
        };

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("plan_requests")
      .update(update)
      .eq("id", requestId)
      .in("status", allowedStatuses)
      .select("id, status, paid_at, reviewed_at")
      .maybeSingle();

    if (error) {
      console.error("Admin plan request update failed:", error.message);
      return jsonError("The plan request could not be updated.", 500);
    }

    if (!data) {
      return jsonError(
        action === "mark_paid"
          ? "Only pending requests can be marked paid."
          : "Only pending or paid requests can be rejected.",
        409
      );
    }

    return NextResponse.json(
      {
        request: data,
        message:
          action === "mark_paid"
            ? "Plan request marked paid."
            : "Plan request rejected.",
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch {
    return jsonError("The plan request is temporarily unavailable.", 500);
  }
}
