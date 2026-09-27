import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/* Team access (sql/phase-28-team-access.sql).
 *
 * A business is its owner's user id: every row carries user_id = the owner.
 * A team member signs in as themselves but works on the owner's rows, so
 * everywhere the app used `user.id` to scope data it now needs the BUSINESS
 * id. The database already enforces this (RLS compares user_id with
 * current_business_id()); this file gives the app the same answer.
 *
 * `getBusinessUser()` has exactly the shape of `supabase.auth.getUser()`, with
 * `user.id` swapped for the business id -- so the ~40 pages that read
 * `user.id` keep working unchanged. The real login id stays available as
 * `getBusinessContext().userId`. For someone without a team the two are the
 * same, which is every account that existed before team access. */

export type BusinessRole = "owner" | "admin" | "staff" | "viewer";

export type BusinessInvite = {
  id: number;
  role: Exclude<BusinessRole, "owner">;
  businessName: string;
};

export type BusinessContext = {
  userId: string;
  businessId: string;
  role: BusinessRole;
  businessName: string | null;
  seatLimit: number;
  invites: BusinessInvite[];
};

type MyBusinessRow = {
  user_id: string;
  business_id: string;
  role: BusinessRole;
  business_name: string | null;
  seat_limit: number | null;
  invites: { id: number; role: BusinessInvite["role"]; business_name: string }[] | null;
};

let cached: { userId: string; promise: Promise<BusinessContext> } | null = null;

function soloContext(userId: string): BusinessContext {
  return {
    userId,
    businessId: userId,
    role: "owner",
    businessName: null,
    seatLimit: 1,
    invites: [],
  };
}

async function loadContext(userId: string): Promise<BusinessContext> {
  const { data, error } = await supabase.rpc("my_business");

  // If the lookup fails, fall back to working on your own rows -- the same
  // thing the database does for anyone without an active membership. It can
  // never widen access: RLS decides what is actually visible.
  if (error || !data) return soloContext(userId);

  const row = data as MyBusinessRow;
  return {
    userId: row.user_id,
    businessId: row.business_id,
    role: row.role,
    businessName: row.business_name,
    seatLimit: row.seat_limit ?? 1,
    invites: (row.invites ?? []).map((invite) => ({
      id: invite.id,
      role: invite.role,
      businessName: invite.business_name,
    })),
  };
}

export async function getBusinessContext(user?: User | null): Promise<BusinessContext | null> {
  const authUser = user ?? (await supabase.auth.getUser()).data.user;
  if (!authUser) return null;

  if (!cached || cached.userId !== authUser.id) {
    cached = { userId: authUser.id, promise: loadContext(authUser.id) };
  }
  return cached.promise;
}

/** Call after joining, leaving or being removed so the next read is fresh. */
export function clearBusinessContext() {
  cached = null;
}

export async function getBusinessId(): Promise<string | null> {
  return (await getBusinessContext())?.businessId ?? null;
}

/** Drop-in for `supabase.auth.getUser()` where `user.id` scopes data. */
export async function getBusinessUser(): ReturnType<typeof supabase.auth.getUser> {
  const result = await supabase.auth.getUser();
  const user = result.data.user;
  if (!user) return result;

  const context = await getBusinessContext(user);
  if (!context || context.businessId === user.id) return result;

  return { ...result, data: { user: { ...user, id: context.businessId } } } as Awaited<
    ReturnType<typeof supabase.auth.getUser>
  >;
}

export function canWrite(role: BusinessRole | undefined) {
  return role !== "viewer";
}

export function canDelete(role: BusinessRole | undefined) {
  return role === undefined || role === "owner" || role === "admin";
}

export function canManageBusiness(role: BusinessRole | undefined) {
  return role === undefined || role === "owner" || role === "admin";
}

export const ROLE_LABELS: Record<BusinessRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  viewer: "View only",
};

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
    clearBusinessContext();
  }
});
