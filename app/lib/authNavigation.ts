import type { SubscriptionPlan } from "@/app/lib/subscription";

export function normalizePlanIntent(value: string | null): SubscriptionPlan {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "standard" || normalized === "pro") {
    return normalized;
  }

  return "free";
}

export function sanitizeReturnTo(value: string | null) {
  // Require a same-origin path. "//host" and "/\host" are treated as
  // protocol-relative URLs by browsers, so both are rejected, along with
  // backslashes and control characters anywhere in the value.
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return "/dashboard";
  }

  return value;
}

export function getAuthIntent(search: string) {
  const params = new URLSearchParams(search);
  const plan = normalizePlanIntent(params.get("plan"));
  const defaultReturnTo =
    plan === "free" ? "/dashboard" : `/request-plan?plan=${plan}`;

  return {
    plan,
    returnTo: sanitizeReturnTo(params.get("returnTo") || defaultReturnTo),
  };
}

export function buildAuthHref(
  pathname: "/login" | "/signup",
  plan: SubscriptionPlan,
  returnTo: string
) {
  const params = new URLSearchParams({
    plan,
    returnTo: sanitizeReturnTo(returnTo),
  });

  return `${pathname}?${params.toString()}`;
}
