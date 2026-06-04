import { supabase } from "@/app/lib/supabase";

export type SubscriptionPlan = "free" | "standard" | "pro";

export interface UserSubscription {
  plan: SubscriptionPlan;
  item_limit: number;
  status: string;
}

export interface SubscriptionUsage {
  subscription: UserSubscription;
  usedItems: number;
}

export const FALLBACK_SUBSCRIPTION: UserSubscription = {
  plan: "free",
  item_limit: 50,
  status: "active",
};

export const PLAN_ITEM_LIMITS: Record<SubscriptionPlan, number> = {
  free: 50,
  standard: 200,
  pro: 1000,
};

function normalizePlan(plan: string | null | undefined): SubscriptionPlan {
  const normalizedPlan = String(plan || "").toLowerCase();

  if (normalizedPlan === "standard" || normalizedPlan === "pro") {
    return normalizedPlan;
  }

  return "free";
}

export function formatPlanName(plan: SubscriptionPlan) {
  const labels: Record<SubscriptionPlan, string> = {
    free: "Free",
    standard: "Standard",
    pro: "Pro",
  };

  return labels[plan] || "Free";
}

export async function getUserSubscription(
  userId: string
): Promise<UserSubscription> {
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("plan, item_limit, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Subscription fetch failed:", error.message);
    return FALLBACK_SUBSCRIPTION;
  }

  if (data) {
    const plan = normalizePlan(data.plan);

    return {
      plan,
      item_limit: PLAN_ITEM_LIMITS[plan],
      status: data.status || "active",
    };
  }

  return FALLBACK_SUBSCRIPTION;
}

export async function countUserInventoryItems(
  userId: string,
  options: { strict?: boolean } = {}
) {
  const { count, error } = await supabase
    .from("inventory")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId);

  if (error) {
    console.warn("Inventory count failed:", error.message);

    if (options.strict) {
      throw new Error("Could not verify your item limit. Please try again.");
    }

    return 0;
  }

  return count || 0;
}

export async function getSubscriptionUsage(
  userId: string,
  options: { strictCount?: boolean } = {}
): Promise<SubscriptionUsage> {
  const [subscription, usedItems] = await Promise.all([
    getUserSubscription(userId),
    countUserInventoryItems(userId, {
      strict: options.strictCount,
    }),
  ]);

  return {
    subscription,
    usedItems,
  };
}

export function getPlanLimitMessage(plan: SubscriptionPlan) {
  return `You reached the ${formatPlanName(
    plan
  )} plan limit. Request Standard or Pro to add more items.`;
}
