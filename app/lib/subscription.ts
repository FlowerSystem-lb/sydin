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

export function formatPlanName(plan: SubscriptionPlan) {
  const labels: Record<SubscriptionPlan, string> = {
    free: "Free",
    standard: "Standard",
    pro: "Pro",
  };

  return labels[plan] || "Free";
}

export async function getOrCreateUserSubscription(
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
    return {
      plan: (data.plan as SubscriptionPlan) || "free",
      item_limit: Number(data.item_limit || 50),
      status: data.status || "active",
    };
  }

  const { data: createdSubscription, error: createError } = await supabase
    .from("user_subscriptions")
    .insert([
      {
        user_id: userId,
        plan: "free",
        item_limit: 50,
        status: "active",
      },
    ])
    .select("plan, item_limit, status")
    .single();

  if (createError) {
    console.warn("Subscription create failed:", createError.message);
    return FALLBACK_SUBSCRIPTION;
  }

  return {
    plan: (createdSubscription.plan as SubscriptionPlan) || "free",
    item_limit: Number(createdSubscription.item_limit || 50),
    status: createdSubscription.status || "active",
  };
}

export async function countUserInventoryItems(userId: string) {
  const { count, error } = await supabase
    .from("inventory")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId);

  if (error) {
    console.warn("Inventory count failed:", error.message);
    return 0;
  }

  return count || 0;
}

export async function getSubscriptionUsage(
  userId: string
): Promise<SubscriptionUsage> {
  const [subscription, usedItems] = await Promise.all([
    getOrCreateUserSubscription(userId),
    countUserInventoryItems(userId),
  ]);

  return {
    subscription,
    usedItems,
  };
}
