import "server-only";

import { randomInt } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

/* Team logins created by the owner (28 Sep 2026).
 *
 * Many shop workers have no email they use, so the owner types a name and a
 * role and SydIN makes the login itself: name.role@business.sydin.site plus a
 * generated password. sydin.site is Sayed's domain -- nobody outside can
 * receive mail at these addresses or register them elsewhere.
 *
 * Creating and deleting auth users needs the service-role key, so this runs
 * only on the server. Every permission decision still happens in the database:
 * the caller's own token is used to call invite_member / list_team /
 * my_business, which re-check role and seats (sql/phase-28-team-access.sql).
 * The service role only does the two things a signed-in user cannot: create
 * the auth user and attach it to the membership row. */

export const MANAGED_LOGIN_DOMAIN = "sydin.site";

export type TeamCaller = {
  userId: string;
  businessId: string;
  role: "owner" | "admin" | "staff" | "viewer";
  businessName: string | null;
  asCaller: SupabaseClient;
};

export class TeamError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function bearerToken(request: Request) {
  const [scheme, token] = (request.headers.get("authorization") || "").trim().split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

/** The signed-in owner or admin making this request, or a TeamError. */
export async function authorizeTeamManager(request: Request): Promise<TeamCaller> {
  const token = bearerToken(request);
  if (!token) throw new TeamError("Please sign in again.", 401);

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw new TeamError("Your session could not be verified.", 401);

  const asCaller = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const { data: business, error: businessError } = await asCaller.rpc("my_business");
  if (businessError || !business) throw new TeamError("Could not load your business.", 500);

  const role = business.role as TeamCaller["role"];
  if (role !== "owner" && role !== "admin") {
    throw new TeamError("Only the owner or an admin can manage the team.", 403);
  }

  return {
    userId: data.user.id,
    businessId: business.business_id,
    role,
    businessName: business.business_name ?? null,
    asCaller,
  };
}

function slug(value: string, fallback: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return cleaned || fallback;
}

const ROLE_WORD = { admin: "admin", staff: "staff", viewer: "viewer" } as const;

export function managedLoginEmail(name: string, role: keyof typeof ROLE_WORD, businessName: string, n = 0) {
  const who = slug(name, "member") + (n > 0 ? String(n + 1) : "");
  return `${who}.${ROLE_WORD[role]}@${slug(businessName, "team")}.${MANAGED_LOGIN_DOMAIN}`;
}

export function isManagedLogin(email: string | null | undefined) {
  return Boolean(email && new RegExp(`@[a-z0-9]+\\.${MANAGED_LOGIN_DOMAIN.replace(".", "\\.")}$`).test(email));
}

/* Word-digits-word ("Cedar-4827-Mint"): Sayed asked for passwords a worker
   can read off WhatsApp and type on a phone. 64 x 9000 x 64 = ~37 million
   combinations, and Supabase rate-limits sign-in attempts, so guessing one
   online is not practical. Short, distinct, unambiguous English words. */
const PASSWORD_WORDS = [
  "Cedar", "Mint", "Olive", "River", "Stone", "Maple", "Lemon", "Tiger",
  "Cloud", "Pearl", "Amber", "Coral", "Delta", "Eagle", "Frost", "Grape",
  "Honey", "Ivory", "Jade", "Karma", "Lotus", "Mango", "Noble", "Ocean",
  "Pilot", "Quartz", "Robin", "Solar", "Tulip", "Unity", "Velvet", "Willow",
  "Yacht", "Zebra", "Apple", "Bloom", "Candle", "Dune", "Ember", "Falcon",
  "Garden", "Harbor", "Island", "Jasmine", "Kite", "Lily", "Meadow", "Nectar",
  "Orbit", "Palm", "Rain", "Sage", "Thyme", "Violet", "Wave", "Basil",
  "Comet", "Daisy", "Fern", "Hazel", "Iris", "Juniper", "Lark", "Moss",
];

export function generatePassword() {
  const word = () => PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)];
  const digits = String(randomInt(1000, 10000));
  let second = word();
  const first = word();
  while (second === first) second = word();
  return `${first}-${digits}-${second}`;
}

type TeamRow = { id: number | null; email: string; role: string; is_owner: boolean };

/** A member row of the caller's own business, as the database lets them see it. */
export async function findTeamRow(caller: TeamCaller, memberRow: number) {
  const { data, error } = await caller.asCaller.rpc("list_team");
  if (error) throw new TeamError("Could not load the team.", 500);
  const row = (data as TeamRow[]).find((item) => item.id === memberRow);
  if (!row) throw new TeamError("Team member not found.", 404);
  if (row.role === "admin" && caller.role !== "owner") {
    throw new TeamError("Only the owner can change an admin.", 403);
  }
  return row;
}

export function errorResponseBody(error: unknown) {
  if (error instanceof TeamError) return { status: error.status, message: error.message };
  return { status: 500, message: "Something went wrong. Please try again." };
}
