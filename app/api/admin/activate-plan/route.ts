import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { authorizeAdminRequest } from "@/app/lib/adminAuth";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TargetPlan = "standard" | "pro";
type ActivationAction = "preview" | "activate";

interface PlanRequestRecord {
  id: string | number;
  full_name: string | null;
  email: string | null;
  selected_plan: string | null;
  status: string | null;
  user_id: string | null;
  paid_at: string | null;
  activated_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

interface SubscriptionRecord {
  user_id: string;
  plan: string | null;
  item_limit: number | null;
  status: string | null;
  activated_at: string | null;
  updated_at: string | null;
}

const ACTIVATION_PLANS: Record<
  TargetPlan,
  {
    name: "Standard" | "Pro";
    itemLimit: 250 | 1000;
  }
> = {
  standard: {
    name: "Standard",
    itemLimit: 250,
  },
  pro: {
    name: "Pro",
    itemLimit: 1000,
  },
};

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

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isTargetPlan(value: unknown): value is TargetPlan {
  return value === "standard" || value === "pro";
}

function isActivationAction(value: unknown): value is ActivationAction {
  return value === "preview" || value === "activate";
}

async function findUserByEmail(email: string): Promise<User | null> {
  const admin = getSupabaseAdmin();
  const normalizedEmail = normalizeEmail(email);
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const matchedUser =
      data.users.find(
        (user) => normalizeEmail(user.email) === normalizedEmail
      ) || null;

    if (matchedUser) return matchedUser;

    if (page >= data.lastPage || data.users.length < perPage) {
      return null;
    }
  }

  return null;
}

async function getPlanRequest(requestId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("plan_requests")
    .select(
      "id, full_name, email, selected_plan, status, user_id, paid_at, activated_at, reviewed_by, reviewed_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;

  return data as PlanRequestRecord | null;
}

function validateRequestForActivation(planRequest: PlanRequestRecord | null) {
  if (!planRequest) {
    return "Plan request not found.";
  }

  const status = String(planRequest.status || "pending").toLowerCase();

  if (status !== "pending" && status !== "paid") {
    return "Only pending or paid requests can be activated.";
  }

  if (!normalizeEmail(planRequest.email)) {
    return "This plan request does not include a valid email address.";
  }

  return null;
}

export async function POST(request: Request) {
  const authorization = await authorizeAdminRequest(request);

  if (!authorization.authorized) {
    return jsonError(authorization.message, authorization.status);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("A valid activation request is required.", 400);
  }

  const payload =
    typeof body === "object" && body !== null
      ? (body as {
          action?: unknown;
          request_id?: unknown;
          target_plan?: unknown;
          matched_user_id?: unknown;
        })
      : {};
  const action = payload.action;
  const requestId =
    typeof payload.request_id === "string" ? payload.request_id.trim() : "";
  const targetPlan = payload.target_plan;

  if (!isActivationAction(action) || !requestId || !isTargetPlan(targetPlan)) {
    return jsonError("Unsupported activation request.", 400);
  }

  try {
    const planRequest = await getPlanRequest(requestId);
    const validationError = validateRequestForActivation(planRequest);

    if (validationError || !planRequest) {
      return jsonError(validationError || "Plan request not found.", 409);
    }

    const matchedUser = await findUserByEmail(planRequest.email || "");

    if (!matchedUser) {
      return jsonError(
        "No SydIN account found for this email. Ask the customer to sign up first.",
        404
      );
    }

    const target = ACTIVATION_PLANS[targetPlan];
    const requestStatus = String(
      planRequest.status || "pending"
    ).toLowerCase() as "pending" | "paid";

    if (action === "preview") {
      return NextResponse.json(
        {
          preview: {
            request_id: String(planRequest.id),
            customer_name: planRequest.full_name || "Unnamed requester",
            email: matchedUser.email || planRequest.email,
            matched_user_id: matchedUser.id,
            selected_plan: planRequest.selected_plan || "Standard",
            target_plan: target.name,
            item_limit: target.itemLimit,
            request_status: requestStatus,
          },
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    const expectedUserId =
      typeof payload.matched_user_id === "string"
        ? payload.matched_user_id.trim()
        : "";

    if (!expectedUserId || expectedUserId !== matchedUser.id) {
      return jsonError(
        "The matched account changed. Review the activation details again.",
        409
      );
    }

    const admin = getSupabaseAdmin();
    const { data: existingSubscription, error: subscriptionReadError } =
      await admin
        .from("user_subscriptions")
        .select(
          "user_id, plan, item_limit, status, activated_at, updated_at"
        )
        .eq("user_id", matchedUser.id)
        .maybeSingle();

    if (subscriptionReadError) {
      console.error(
        "Admin subscription read failed:",
        subscriptionReadError.message
      );
      return jsonError(
        "Subscription activation is unavailable because the existing subscription fields could not be verified.",
        500
      );
    }

    const currentSubscription =
      existingSubscription as SubscriptionRecord | null;

    if (
      (normalizeEmail(currentSubscription?.plan) === "pro" ||
        Number(currentSubscription?.item_limit || 0) > target.itemLimit) &&
      targetPlan === "standard"
    ) {
      return jsonError(
        "This account already has a higher plan limit. Activation cannot downgrade it to Standard.",
        409
      );
    }

    const now = new Date().toISOString();
    const { data: activatedRequest, error: requestUpdateError } = await admin
      .from("plan_requests")
      .update({
        status: "activated",
        user_id: matchedUser.id,
        activated_at: now,
        reviewed_by: authorization.user.id,
        reviewed_at: now,
        paid_at: planRequest.paid_at || now,
      })
      .eq("id", planRequest.id)
      .in("status", ["pending", "paid"])
      .select("id")
      .maybeSingle();

    if (requestUpdateError) {
      console.error(
        "Admin activation request update failed:",
        requestUpdateError.message
      );
      return jsonError("The plan request could not be activated.", 500);
    }

    if (!activatedRequest) {
      return jsonError(
        "The request status changed before activation. Refresh and review it again.",
        409
      );
    }

    const { error: subscriptionUpdateError } = await admin
      .from("user_subscriptions")
      .upsert(
        {
          user_id: matchedUser.id,
          plan: targetPlan,
          item_limit: target.itemLimit,
          status: "active",
          activated_at: now,
          updated_at: now,
        },
        {
          onConflict: "user_id",
        }
      );

    if (subscriptionUpdateError) {
      const { error: rollbackError } = await admin
        .from("plan_requests")
        .update({
          status: planRequest.status || "pending",
          user_id: planRequest.user_id,
          paid_at: planRequest.paid_at,
          activated_at: planRequest.activated_at,
          reviewed_by: planRequest.reviewed_by,
          reviewed_at: planRequest.reviewed_at,
        })
        .eq("id", planRequest.id)
        .eq("status", "activated")
        .eq("user_id", matchedUser.id);

      console.error(
        "Admin subscription activation failed:",
        subscriptionUpdateError.message
      );

      if (rollbackError) {
        console.error(
          "Admin activation rollback failed:",
          rollbackError.message
        );
        return jsonError(
          "Activation did not complete cleanly. Check this request and subscription before retrying.",
          500
        );
      }

      return jsonError(
        "Subscription activation failed. The plan request was restored and no plan was activated.",
        500
      );
    }

    return NextResponse.json(
      {
        message: `${target.name} activated for ${matchedUser.email || planRequest.email}.`,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Admin plan activation failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return jsonError("Plan activation is temporarily unavailable.", 500);
  }
}
