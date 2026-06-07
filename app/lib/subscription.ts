import { supabase } from "@/app/lib/supabase";

export type SubscriptionPlan = "free" | "standard" | "pro";
export type PublicPlanId = SubscriptionPlan | "business";
export type UpgradePlan = "Standard" | "Pro" | "Business";
export type BooleanPlanCapability =
  | "productPhotos"
  | "qrPublicPages"
  | "csvExport"
  | "searchAndFilters"
  | "businessName"
  | "customBusinessLogo"
  | "publicContactBranding"
  | "customLowStockThreshold"
  | "scanner"
  | "csvExcelImport"
  | "excelExport"
  | "advancedReportsLater"
  | "reportsCenterLater"
  | "pickListsLater"
  | "analyticsLater"
  | "priorityManualSupport"
  | "teamsRolesLater"
  | "advancedSupportLater";

export interface PlanCapabilities {
  itemLimit: number | null;
  productPhotos: boolean;
  qrPublicPages: boolean;
  csvExport: boolean;
  stockMovements: "basic";
  depotLimit: number | null;
  searchAndFilters: boolean;
  businessName: boolean;
  customBusinessLogo: boolean;
  publicContactBranding: boolean;
  customLowStockThreshold: boolean;
  scanner: boolean;
  csvExcelImport: boolean;
  excelExport: boolean;
  pdfExport: "none" | "basic";
  advancedReportsLater: boolean;
  reportsCenterLater: boolean;
  pickListsLater: boolean;
  analyticsLater: boolean;
  priorityManualSupport: boolean;
  teamsRolesLater: boolean;
  advancedSupportLater: boolean;
}

export interface PlanDefinition {
  id: PublicPlanId;
  name: string;
  priceMonthly: number | null;
  itemLimit: number | null;
  description: string;
  audience: string;
  featured?: boolean;
  available: boolean;
  ctaLabel: string;
  ctaHref: string;
  highlights: string[];
  capabilities: PlanCapabilities;
}

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
  standard: 250,
  pro: 1000,
};

export const FREE_LOW_STOCK_THRESHOLD = 10;

export const PLAN_DEFINITIONS: Record<PublicPlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    itemLimit: PLAN_ITEM_LIMITS.free,
    description: "A complete starting point for small visual inventories.",
    audience: "For trying SydIN with real business inventory.",
    available: true,
    ctaLabel: "Start Free",
    ctaHref: "/signup",
    highlights: [
      "Up to 50 items",
      "Product photos and QR pages",
      "CSV export",
      "Basic stock movements",
      "1 depot",
    ],
    capabilities: {
      itemLimit: PLAN_ITEM_LIMITS.free,
      productPhotos: true,
      qrPublicPages: true,
      csvExport: true,
      stockMovements: "basic",
      depotLimit: 1,
      searchAndFilters: true,
      businessName: true,
      customBusinessLogo: false,
      publicContactBranding: false,
      customLowStockThreshold: false,
      scanner: false,
      csvExcelImport: false,
      excelExport: false,
      pdfExport: "none",
      advancedReportsLater: false,
      reportsCenterLater: false,
      pickListsLater: false,
      analyticsLater: false,
      priorityManualSupport: false,
      teamsRolesLater: false,
      advancedSupportLater: false,
    },
  },
  standard: {
    id: "standard",
    name: "Standard",
    priceMonthly: 19,
    itemLimit: PLAN_ITEM_LIMITS.standard,
    description: "Daily inventory tools for growing small businesses.",
    audience: "For teams ready to import, scan, and organize across locations.",
    featured: true,
    available: true,
    ctaLabel: "Request Standard",
    ctaHref: "/request-plan?plan=Standard",
    highlights: [
      "Up to 250 items",
      "3 depots",
      "Custom logo and low-stock threshold",
      "Scanner and CSV/Excel import",
      "Excel and basic PDF export",
    ],
    capabilities: {
      itemLimit: PLAN_ITEM_LIMITS.standard,
      productPhotos: true,
      qrPublicPages: true,
      csvExport: true,
      stockMovements: "basic",
      depotLimit: 3,
      searchAndFilters: true,
      businessName: true,
      customBusinessLogo: true,
      publicContactBranding: true,
      customLowStockThreshold: true,
      scanner: true,
      csvExcelImport: true,
      excelExport: true,
      pdfExport: "basic",
      advancedReportsLater: false,
      reportsCenterLater: false,
      pickListsLater: false,
      analyticsLater: false,
      priorityManualSupport: false,
      teamsRolesLater: false,
      advancedSupportLater: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    itemLimit: PLAN_ITEM_LIMITS.pro,
    description: "More capacity and the foundation for advanced operations.",
    audience: "For established businesses with larger catalogs and reporting needs.",
    available: true,
    ctaLabel: "Request Pro",
    ctaHref: "/request-plan?plan=Pro",
    highlights: [
      "Up to 1,000 items",
      "10 depots",
      "Everything in Standard",
      "Advanced reports and analytics later",
      "Priority manual support during beta",
    ],
    capabilities: {
      itemLimit: PLAN_ITEM_LIMITS.pro,
      productPhotos: true,
      qrPublicPages: true,
      csvExport: true,
      stockMovements: "basic",
      depotLimit: 10,
      searchAndFilters: true,
      businessName: true,
      customBusinessLogo: true,
      publicContactBranding: true,
      customLowStockThreshold: true,
      scanner: true,
      csvExcelImport: true,
      excelExport: true,
      pdfExport: "basic",
      advancedReportsLater: true,
      reportsCenterLater: true,
      pickListsLater: true,
      analyticsLater: true,
      priorityManualSupport: true,
      teamsRolesLater: false,
      advancedSupportLater: false,
    },
  },
  business: {
    id: "business",
    name: "Business",
    priceMonthly: null,
    itemLimit: null,
    description: "A future plan for larger teams and custom operations.",
    audience: "For organizations that need tailored limits and support.",
    available: false,
    ctaLabel: "Coming Later",
    ctaHref: "/contact",
    highlights: [
      "Custom item limits",
      "Everything in Pro",
      "Teams and roles later",
      "Advanced support later",
      "Custom operational planning",
    ],
    capabilities: {
      itemLimit: null,
      productPhotos: true,
      qrPublicPages: true,
      csvExport: true,
      stockMovements: "basic",
      depotLimit: null,
      searchAndFilters: true,
      businessName: true,
      customBusinessLogo: true,
      publicContactBranding: true,
      customLowStockThreshold: true,
      scanner: true,
      csvExcelImport: true,
      excelExport: true,
      pdfExport: "basic",
      advancedReportsLater: true,
      reportsCenterLater: true,
      pickListsLater: true,
      analyticsLater: true,
      priorityManualSupport: true,
      teamsRolesLater: true,
      advancedSupportLater: true,
    },
  },
};

export const PUBLIC_PLAN_ORDER: PublicPlanId[] = [
  "free",
  "standard",
  "pro",
  "business",
];

function normalizePlan(plan: string | null | undefined): SubscriptionPlan {
  const normalizedPlan = String(plan || "").toLowerCase();

  if (normalizedPlan === "standard" || normalizedPlan === "pro") {
    return normalizedPlan;
  }

  return "free";
}

function isActiveStatus(status: string | null | undefined) {
  return String(status || "").trim().toLowerCase() === "active";
}

export function getEffectivePlan(
  subscription: Pick<UserSubscription, "plan" | "status">
): SubscriptionPlan {
  return isActiveStatus(subscription.status)
    ? normalizePlan(subscription.plan)
    : "free";
}

export function getSubscriptionCapabilities(
  subscription: Pick<UserSubscription, "plan" | "status">
) {
  return PLAN_DEFINITIONS[getEffectivePlan(subscription)].capabilities;
}

export function hasSubscriptionCapability(
  subscription: Pick<UserSubscription, "plan" | "status">,
  capability: BooleanPlanCapability
) {
  return getSubscriptionCapabilities(subscription)[capability];
}

export function getSubscriptionDepotLimit(
  subscription: Pick<UserSubscription, "plan" | "status">
) {
  return getSubscriptionCapabilities(subscription).depotLimit || 1;
}

export function getEffectiveLowStockThreshold(
  subscription: Pick<UserSubscription, "plan" | "status">,
  storedThreshold: number
) {
  if (
    !hasSubscriptionCapability(subscription, "customLowStockThreshold")
  ) {
    return FREE_LOW_STOCK_THRESHOLD;
  }

  return Number.isFinite(storedThreshold) && storedThreshold >= 0
    ? Math.round(storedThreshold)
    : FREE_LOW_STOCK_THRESHOLD;
}

export function getUpgradePlanForDepotLimit(
  plan: SubscriptionPlan
): UpgradePlan {
  if (plan === "free") return "Standard";
  if (plan === "standard") return "Pro";
  return "Business";
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
    const storedPlan = normalizePlan(data.plan);
    const status = data.status || "inactive";
    const plan = isActiveStatus(status) ? storedPlan : "free";

    return {
      plan,
      item_limit: PLAN_ITEM_LIMITS[plan],
      status,
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
