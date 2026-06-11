import { supabase } from "@/app/lib/supabase";

export type OnboardingStepStatus =
  | "completed"
  | "pending"
  | "unavailable";

export interface OnboardingStep {
  id: "item" | "depot" | "category" | "supplier" | "pick-list";
  title: string;
  description: string;
  href: string;
  action: string;
  status: OnboardingStepStatus;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  percentage: number;
  nextStep: OnboardingStep | null;
  hasPartialError: boolean;
}

const STEP_DEFINITIONS: Omit<OnboardingStep, "status">[] = [
  {
    id: "item",
    title: "Add your first item",
    description: "Start the inventory with one real product or asset.",
    href: "/dashboard/add-item",
    action: "Add Item",
  },
  {
    id: "depot",
    title: "Create a depot",
    description: "Add a shop, storage room, warehouse, or other location.",
    href: "/dashboard/depots",
    action: "Add Depot",
  },
  {
    id: "category",
    title: "Create a category",
    description: "Keep similar inventory items grouped consistently.",
    href: "/dashboard/categories",
    action: "Add Category",
  },
  {
    id: "supplier",
    title: "Create a supplier",
    description: "Save a vendor you regularly purchase inventory from.",
    href: "/dashboard/suppliers",
    action: "Add Supplier",
  },
  {
    id: "pick-list",
    title: "Create a Pick List",
    description: "Prepare an order, event, or project from current inventory.",
    href: "/dashboard/pick-lists",
    action: "Create Pick List",
  },
];

async function countRows(table: string, userId: string) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count || 0;
}

export async function getOnboardingProgress(
  userId: string
): Promise<OnboardingProgress> {
  const results = await Promise.allSettled([
    countRows("inventory", userId),
    countRows("depots", userId),
    countRows("categories", userId),
    countRows("suppliers", userId),
    countRows("pick_lists", userId),
  ]);

  const steps = STEP_DEFINITIONS.map<OnboardingStep>((step, index) => {
    const result = results[index];

    return {
      ...step,
      status:
        result.status === "rejected"
          ? "unavailable"
          : result.value > 0
            ? "completed"
            : "pending",
    };
  });
  const completedCount = steps.filter(
    (step) => step.status === "completed"
  ).length;
  const totalCount = steps.length;

  return {
    steps,
    completedCount,
    totalCount,
    percentage: Math.round((completedCount / totalCount) * 100),
    nextStep: steps.find((step) => step.status === "pending") || null,
    hasPartialError: steps.some((step) => step.status === "unavailable"),
  };
}
