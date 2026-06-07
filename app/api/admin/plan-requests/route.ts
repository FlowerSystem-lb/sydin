import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlanRequestRow = Record<string, unknown>;

function asNullableString(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized || null;
}

function normalizeStatus(value: unknown) {
  const status = asNullableString(value)?.toLowerCase();

  if (
    status === "pending" ||
    status === "paid" ||
    status === "activated" ||
    status === "rejected"
  ) {
    return status;
  }

  return "pending";
}

function normalizePlanRequest(row: PlanRequestRow, index: number) {
  const rawId = row.id;
  const id =
    typeof rawId === "string" || typeof rawId === "number"
      ? String(rawId)
      : `request-${index + 1}`;

  return {
    id,
    full_name: asNullableString(row.full_name) || "Unnamed requester",
    business_name: asNullableString(row.business_name),
    email: asNullableString(row.email) || "",
    phone: asNullableString(row.phone),
    selected_plan: asNullableString(row.selected_plan) || "Standard",
    message: asNullableString(row.message),
    created_at: asNullableString(row.created_at),
    status: normalizeStatus(row.status),
    user_id: asNullableString(row.user_id),
    paid_at: asNullableString(row.paid_at),
    activated_at: asNullableString(row.activated_at),
    reviewed_at: asNullableString(row.reviewed_at),
  };
}

function dateValue(value: string | null) {
  if (!value) return 0;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export async function GET(request: Request) {
  const authorization = await authorizeAdminRequest(request);

  if (!authorization.authorized) {
    return NextResponse.json(
      {
        error: authorization.message,
      },
      {
        status: authorization.status,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("plan_requests")
      .select("*")
      .limit(500);

    if (error) {
      console.error("Admin plan request read failed:", error.message);

      return NextResponse.json(
        {
          error: "Plan requests could not be loaded.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    const requests = ((data || []) as PlanRequestRow[])
      .map(normalizePlanRequest)
      .sort(
        (first, second) =>
          dateValue(second.created_at) - dateValue(first.created_at)
      );

    return NextResponse.json(
      {
        requests,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        error: "Plan requests are temporarily unavailable.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  }
}
