import "server-only";

import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export type AdminAuthorization =
  | {
      authorized: true;
      user: User;
    }
  | {
      authorized: false;
      status: 401 | 403 | 500;
      message: string;
      /** "mfa_required": an admin whose session has not passed the
       *  authenticator-app code yet (the client shows the code screen). */
      code?: "mfa_required";
    };

function getAdminUserIds() {
  return new Set(
    String(process.env.SYDIN_ADMIN_USER_IDS || "")
      .split(/[\s,]+/)
      .map((userId) => userId.trim())
      .filter(Boolean)
  );
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token;
}

/* The assurance level Supabase put in the session token: "aal2" once the
   authenticator-app code has been entered in this session. Read only AFTER
   getUser() has verified the token with Supabase, so the claim is trusted. */
function sessionAssuranceLevel(token: string) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return (JSON.parse(json) as { aal?: string }).aal ?? "aal1";
  } catch {
    return "aal1";
  }
}

/**
 * Admin requests need three things (30 Sep 2026, Sayed: "strict privacy"):
 * a verified SydIN session, an account listed in SYDIN_ADMIN_USER_IDS, and --
 * unless `requireMfa: false` -- a session that passed the authenticator-app
 * code (aal2). A stolen password alone opens nothing here.
 */
export async function authorizeAdminRequest(
  request: Request,
  { requireMfa = true }: { requireMfa?: boolean } = {}
): Promise<AdminAuthorization> {
  const token = getBearerToken(request);

  if (!token) {
    return {
      authorized: false,
      status: 401,
      message: "A valid SydIN session is required.",
    };
  }

  const adminUserIds = getAdminUserIds();

  if (adminUserIds.size === 0) {
    return {
      authorized: false,
      status: 500,
      message: "Admin access is not configured.",
    };
  }

  try {
    const {
      data: { user },
      error,
    } = await getSupabaseAdmin().auth.getUser(token);

    if (error || !user) {
      return {
        authorized: false,
        status: 401,
        message: "Your session could not be verified.",
      };
    }

    if (!adminUserIds.has(user.id)) {
      return {
        authorized: false,
        status: 403,
        message: "This account does not have SydIN admin access.",
      };
    }

    if (requireMfa && sessionAssuranceLevel(token) !== "aal2") {
      return {
        authorized: false,
        status: 403,
        message: "Enter the code from your authenticator app to continue.",
        code: "mfa_required",
      };
    }

    return {
      authorized: true,
      user,
    };
  } catch {
    return {
      authorized: false,
      status: 500,
      message: "Admin authorization is temporarily unavailable.",
    };
  }
}
