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

export async function authorizeAdminRequest(
  request: Request
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
