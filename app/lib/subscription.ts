import { supabase } from "@/app/lib/supabase";

export type SubscriptionPlan = "free" | "standard" | "pro";
export type PublicPlanId = SubscriptionPlan;
export type UpgradePlan = "Standard" | "Pro" | "Contact";
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
  | "purchaseOrders"
  | "receiving"
  | "advancedReports"
  | "dashboardAnalytics"
  | "helpCenter"
  | "appearanceSettings"
  | "priorityManualSupport";

export interface PlanCapabilities {
  itemLimit: number | null;
  productPhotos: boolean;
  qrPublicPages: boolean;
  csvExport: boolean;
  stockMovements: "basic";
  depotLimit: number | null;
  supplierLimit: number | null;
  customerLimit: number | null;
  categoryLimit: number | null;
  activePickListLimit: number | null;
  searchAndFilters: boolean;
  businessName: boolean;
  customBusinessLogo: boolean;
  publicContactBranding: boolean;
  customLowStockThreshold: boolean;
  scanner: boolean;
  csvExcelImport: boolean;
  excelExport: boolean;
  pdfExport: "none" | "basic";
  /**
   * The buying side of the depot: raising purchase orders and booking stock in
   * against them. Free deliberately stops at "know what you have" -- which is
   * the promise the landing page makes -- so the purchasing workflow is the
   * first thing a growing wholesaler pays for.
   */
  purchaseOrders: boolean;
  receiving: boolean;
  advancedReports: boolean;
  dashboardAnalytics: boolean;
  helpCenter: boolean;
  appearanceSettings: boolean;
  priorityManualSupport: boolean;
}

export interface PlanDefinition {
  id: PublicPlanId;
  name: string;
  priceMonthly: number | null;
  /**
   * Yearly price in USD, billed once. Set at 10x the monthly rate, so two
   * months are effectively free -- the standard SaaS discount, and worth more
   * than usual here: it collects cash up front and spares the customer eleven
   * more manual transfers, since plans are activated by hand (Whish/OMT)
   * rather than by a card on file.
   */
  priceYearly: number | null;
  description: string;
  audience: string;
  featured?: boolean;
  available: boolean;
  ctaLabel: string;
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

export const PLAN_SUPPLIER_LIMITS: Record<SubscriptionPlan, number> = {
  free: 3,
  standard: 25,
  pro: 100,
};

/**
 * Who the depot sells to. Matched to the supplier numbers deliberately: a
 * wholesaler with three suppliers has roughly three regular buyers, and a
 * different shape here would be a pricing decision dressed up as a default.
 */
export const PLAN_CUSTOMER_LIMITS: Record<SubscriptionPlan, number> = {
  free: 3,
  standard: 25,
  pro: 100,
};

export const PLAN_CATEGORY_LIMITS: Record<SubscriptionPlan, number> = {
  free: 5,
  standard: 50,
  pro: 200,
};

export const PLAN_ACTIVE_PICK_LIST_LIMITS: Record<
  SubscriptionPlan,
  number | null
> = {
  free: 3,
  standard: 50,
  pro: null,
};

export const FREE_LOW_STOCK_THRESHOLD = 10;

export const PLAN_DEFINITIONS: Record<PublicPlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    description: "A complete starting point for small visual inventories.",
    audience: "For trying SydIN with real business inventory.",
    available: true,
    ctaLabel: "Start Free",
    highlights: [
      "Up to 50 items with photos",
      "1 depot, 3 suppliers, 5 categories",
      "Stock history and low-stock alerts",
      "Public QR item pages",
      "CSV export included",
    ],
    capabilities: {
      itemLimit: PLAN_ITEM_LIMITS.free,
      productPhotos: true,
      qrPublicPages: true,
      csvExport: true,
      stockMovements: "basic",
      depotLimit: 1,
      supplierLimit: PLAN_SUPPLIER_LIMITS.free,
      customerLimit: PLAN_CUSTOMER_LIMITS.free,
      categoryLimit: PLAN_CATEGORY_LIMITS.free,
      activePickListLimit: PLAN_ACTIVE_PICK_LIST_LIMITS.free,
      searchAndFilters: true,
      businessName: true,
      customBusinessLogo: false,
      publicContactBranding: false,
      customLowStockThreshold: false,
      scanner: false,
      csvExcelImport: false,
      excelExport: false,
      pdfExport: "none",
      purchaseOrders: false,
      receiving: false,
      advancedReports: false,
      dashboardAnalytics: false,
      helpCenter: true,
      appearanceSettings: true,
      priorityManualSupport: false,
    },
  },
  standard: {
    id: "standard",
    name: "Standard",
    priceMonthly: 9,
    priceYearly: 90,
    description: "Daily inventory tools for growing small businesses.",
    audience: "For teams ready to import, scan, and organize across locations.",
    featured: true,
    available: true,
    ctaLabel: "Request Standard",
    highlights: [
      "Up to 250 items",
      "3 depots, 25 suppliers, 50 categories",
      "Purchase orders and receiving",
      "Phone barcode scanner",
      "Excel/CSV import, Excel and PDF export",
    ],
    capabilities: {
      itemLimit: PLAN_ITEM_LIMITS.standard,
      productPhotos: true,
      qrPublicPages: true,
      csvExport: true,
      stockMovements: "basic",
      depotLimit: 3,
      supplierLimit: PLAN_SUPPLIER_LIMITS.standard,
      customerLimit: PLAN_CUSTOMER_LIMITS.standard,
      categoryLimit: PLAN_CATEGORY_LIMITS.standard,
      activePickListLimit: PLAN_ACTIVE_PICK_LIST_LIMITS.standard,
      searchAndFilters: true,
      businessName: true,
      customBusinessLogo: true,
      publicContactBranding: true,
      customLowStockThreshold: true,
      scanner: true,
      csvExcelImport: true,
      excelExport: true,
      pdfExport: "basic",
      purchaseOrders: true,
      receiving: true,
      advancedReports: true,
      dashboardAnalytics: true,
      helpCenter: true,
      appearanceSettings: true,
      priorityManualSupport: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 19,
    priceYearly: 190,
    description: "More capacity for advanced inventory operations.",
    audience: "For established businesses with larger catalogs and active order preparation.",
    available: true,
    ctaLabel: "Request Pro",
    highlights: [
      "Up to 1,000 items",
      "10 depots, 100 suppliers, 200 categories",
      "Unlimited active Pick Lists",
      "Everything in Standard",
      "Priority support during early access",
    ],
    capabilities: {
      itemLimit: PLAN_ITEM_LIMITS.pro,
      productPhotos: true,
      qrPublicPages: true,
      csvExport: true,
      stockMovements: "basic",
      depotLimit: 10,
      supplierLimit: PLAN_SUPPLIER_LIMITS.pro,
      customerLimit: PLAN_CUSTOMER_LIMITS.pro,
      categoryLimit: PLAN_CATEGORY_LIMITS.pro,
      activePickListLimit: PLAN_ACTIVE_PICK_LIST_LIMITS.pro,
      searchAndFilters: true,
      businessName: true,
      customBusinessLogo: true,
      publicContactBranding: true,
      customLowStockThreshold: true,
      scanner: true,
      csvExcelImport: true,
      excelExport: true,
      pdfExport: "basic",
      purchaseOrders: true,
      receiving: true,
      advancedReports: true,
      dashboardAnalytics: true,
      helpCenter: true,
      appearanceSettings: true,
      priorityManualSupport: true,
    },
  },
};

export const PUBLIC_PLAN_ORDER: PublicPlanId[] = ["free", "standard", "pro"];

export const PLAN_COMPARISON_ROWS = [
  {
    feature: "Items",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      Number(
        PLAN_DEFINITIONS[plan].capabilities.itemLimit
      ).toLocaleString()
    ),
  },
  {
    feature: "Depots",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      String(PLAN_DEFINITIONS[plan].capabilities.depotLimit)
    ),
  },
  {
    feature: "Suppliers",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      String(PLAN_DEFINITIONS[plan].capabilities.supplierLimit)
    ),
  },
  {
    feature: "Customers",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      String(PLAN_DEFINITIONS[plan].capabilities.customerLimit)
    ),
  },
  {
    feature: "Categories",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      String(PLAN_DEFINITIONS[plan].capabilities.categoryLimit)
    ),
  },
  {
    feature: "Active Pick Lists",
    values: PUBLIC_PLAN_ORDER.map((plan) => {
      const limit = PLAN_DEFINITIONS[plan].capabilities.activePickListLimit;
      return limit === null ? "Unlimited" : String(limit);
    }),
  },
  {
    feature: "Public QR item pages",
    values: PUBLIC_PLAN_ORDER.map(() => "Included"),
  },
  {
    feature: "Purchase orders",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      PLAN_DEFINITIONS[plan].capabilities.purchaseOrders ? "Included" : "—"
    ),
  },
  {
    feature: "Receiving stock",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      PLAN_DEFINITIONS[plan].capabilities.receiving ? "Included" : "—"
    ),
  },
  {
    feature: "Product photos and stock movements",
    values: PUBLIC_PLAN_ORDER.map(() => "Included"),
  },
  {
    feature: "CSV export",
    values: PUBLIC_PLAN_ORDER.map(() => "Included"),
  },
  {
    feature: "QR logo and contact branding",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      PLAN_DEFINITIONS[plan].capabilities.publicContactBranding
        ? "Included"
        : "Not included"
    ),
  },
  {
    feature: "Import inventory",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      PLAN_DEFINITIONS[plan].capabilities.csvExcelImport
        ? "Included"
        : "Not included"
    ),
  },
  {
    feature: "Inventory scanner",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      PLAN_DEFINITIONS[plan].capabilities.scanner
        ? "Included"
        : "Not included"
    ),
  },
  {
    feature: "Excel and PDF export",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      PLAN_DEFINITIONS[plan].capabilities.excelExport
        ? "Included"
        : "Not included"
    ),
  },
  {
    feature: "Advanced reports",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      PLAN_DEFINITIONS[plan].capabilities.advancedReports
        ? "Included"
        : "Not included"
    ),
  },
  {
    feature: "Dashboard value analytics",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      PLAN_DEFINITIONS[plan].capabilities.dashboardAnalytics
        ? "Included"
        : "Basic overview"
    ),
  },
  {
    feature: "Custom low-stock threshold",
    values: PUBLIC_PLAN_ORDER.map((plan) =>
      PLAN_DEFINITIONS[plan].capabilities.customLowStockThreshold
        ? "Included"
        : "Fixed at 10"
    ),
  },
  {
    feature: "Help Center and onboarding",
    values: PUBLIC_PLAN_ORDER.map(() => "Included"),
  },
  {
    feature: "Premium light workspace",
    values: PUBLIC_PLAN_ORDER.map(() => "Included"),
  },
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
  return getSubscriptionCapabilities(subscription).depotLimit ?? 1;
}

export function getSubscriptionCustomerLimit(
  subscription: Pick<UserSubscription, "plan" | "status">
) {
  return (
    getSubscriptionCapabilities(subscription).customerLimit ??
    PLAN_CUSTOMER_LIMITS.free
  );
}

export function getSubscriptionSupplierLimit(
  subscription: Pick<UserSubscription, "plan" | "status">
) {
  return (
    getSubscriptionCapabilities(subscription).supplierLimit ??
    PLAN_SUPPLIER_LIMITS.free
  );
}

export function getSubscriptionCategoryLimit(
  subscription: Pick<UserSubscription, "plan" | "status">
) {
  return (
    getSubscriptionCapabilities(subscription).categoryLimit ??
    PLAN_CATEGORY_LIMITS.free
  );
}

export function getSubscriptionPickListLimit(
  subscription: Pick<UserSubscription, "plan" | "status">
) {
  return getSubscriptionCapabilities(subscription).activePickListLimit;
}

export function getUpgradePlanForCategoryLimit(
  plan: SubscriptionPlan
): UpgradePlan {
  return getUpgradePlanForCurrentPlan(plan);
}

export function getUpgradePlanForSupplierLimit(
  plan: SubscriptionPlan
): UpgradePlan {
  return getUpgradePlanForCurrentPlan(plan);
}

export function getUpgradePlanForPickListLimit(
  plan: SubscriptionPlan
): UpgradePlan {
  return getUpgradePlanForCurrentPlan(plan);
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
  return getUpgradePlanForCurrentPlan(plan);
}

export function getUpgradePlanForCurrentPlan(
  plan: SubscriptionPlan
): UpgradePlan {
  if (plan === "free") return "Standard";
  if (plan === "standard") return "Pro";
  return "Contact";
}

export function getUpgradeRequestHref(
  plan: SubscriptionPlan,
  source: string
) {
  const target = getUpgradePlanForCurrentPlan(plan);

  if (target === "Contact") {
    return `/contact?source=${encodeURIComponent(source)}`;
  }

  return `/request-plan?plan=${target.toLowerCase()}&source=${encodeURIComponent(
    source
  )}`;
}

export function getUpgradeActionLabel(plan: SubscriptionPlan) {
  const target = getUpgradePlanForCurrentPlan(plan);
  return target === "Contact" ? "Contact SydIN" : `Request ${target}`;
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
  const nextStep =
    plan === "free"
      ? "Request Standard"
      : plan === "standard"
        ? "Request Pro"
        : "Contact SydIN";

  return `You reached the ${formatPlanName(
    plan
  )} plan limit. Existing items remain available. ${nextStep} to add more.`;
}
