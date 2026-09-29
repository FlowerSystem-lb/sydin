"use client";

import { supabase } from "@/app/lib/supabase";

/* Browser side of the admin console: every call carries the admin's own
   session (which has passed the authenticator code). The server decides. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
  });
  const answer = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(answer.error || "Something went wrong.");
  return answer;
}

export interface AdminCustomer {
  user_id: string;
  email: string | null;
  signed_up: string;
  last_sign_in: string | null;
  business_name: string | null;
  phone: string | null;
  plan: string;
  status: string;
  paid_until: string | null;
  billing_cycle: string | null;
  cancel_at_period_end: boolean;
  effective_plan: "free" | "standard" | "pro";
  last_paid_at: string | null;
  total_paid: number;
  items: number;
  members: number;
  is_team_member: boolean;
}

export type CustomerState = "paid" | "no_end" | "due_soon" | "grace" | "ended" | "cancelled" | "free";

export const CUSTOMER_STATE_LABELS: Record<CustomerState, string> = {
  paid: "Paid",
  no_end: "Paid · no end date",
  due_soon: "Due soon",
  grace: "In grace",
  ended: "Ended",
  cancelled: "Cancelled",
  free: "Free",
};

const DAY = 86400000;

/** Same rule as effective_plan() in sql/phase-32-billing.sql. */
export function customerState(row: Pick<AdminCustomer, "plan" | "status" | "paid_until">): CustomerState {
  if (row.status === "cancelled") return "cancelled";
  if (!["standard", "pro"].includes(row.plan) || row.status !== "active") return "free";
  if (!row.paid_until) return "no_end";
  const end = Date.parse(row.paid_until);
  const now = Date.now();
  if (now > end + 3 * DAY) return "ended";
  if (now > end) return "grace";
  if (end - now <= 7 * DAY) return "due_soon";
  return "paid";
}

export function formatAdminDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount || 0);
}

export function planLabel(plan: string) {
  return plan === "pro" ? "Pro" : plan === "standard" ? "Standard" : "Free";
}

/** WhatsApp link to a customer with a ready reminder (opened by Sayed). */
export function reminderWhatsApp(row: Pick<AdminCustomer, "phone" | "business_name" | "plan" | "paid_until">) {
  const digits = String(row.phone || "").replace(/[^\d]/g, "").replace(/^00/, "");
  if (!digits) return null;
  const number = digits.startsWith("961") || digits.length > 9 ? digits : `961${digits.replace(/^0/, "")}`;
  const end = row.paid_until ? formatAdminDate(row.paid_until) : "";
  const message = [
    `Hello${row.business_name ? ` ${row.business_name}` : ""}, this is SydIN.`,
    end
      ? `Your ${planLabel(row.plan)} plan ${Date.parse(row.paid_until as string) < Date.now() ? "ended on" : "renews on"} ${end}.`
      : `About your ${planLabel(row.plan)} plan.`,
    "You can pay by Whish Money or OMT to +961 76 075 247 and send the receipt here. You have 3 days after the end date; your data is always kept.",
  ].join(" ");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
