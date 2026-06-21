import type { UiIconName } from "@/components/UiIcon";

export type DashboardNavigationSection =
  | "workspace"
  | "operations"
  | "organize"
  | "insights"
  | "system";

export interface DashboardNavigationItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: UiIconName;
  section: DashboardNavigationSection;
  mobilePlacement: "primary" | "more";
}

export const DASHBOARD_SECTION_LABELS: Record<
  DashboardNavigationSection,
  string
> = {
  workspace: "Workspace",
  operations: "Operations",
  organize: "Organize",
  insights: "Insights",
  system: "System",
};

export const DASHBOARD_SECTION_ORDER: DashboardNavigationSection[] = [
  "workspace",
  "operations",
  "organize",
  "insights",
  "system",
];

export const DASHBOARD_NAVIGATION: DashboardNavigationItem[] = [
  {
    label: "Overview",
    shortLabel: "Home",
    href: "/dashboard",
    icon: "dashboard",
    section: "workspace",
    mobilePlacement: "primary",
  },
  {
    label: "Inventory",
    href: "/dashboard/inventory",
    icon: "box",
    section: "workspace",
    mobilePlacement: "primary",
  },
  {
    label: "Pick Lists",
    href: "/dashboard/pick-lists",
    icon: "picklists",
    section: "operations",
    mobilePlacement: "primary",
  },
  {
    label: "Stock Movements",
    shortLabel: "Movements",
    href: "/dashboard/stock-movements",
    icon: "movement",
    section: "operations",
    mobilePlacement: "more",
  },
  {
    label: "Stock Counts",
    shortLabel: "Counts",
    href: "/dashboard/stock-counts",
    icon: "check",
    section: "operations",
    mobilePlacement: "more",
  },
  {
    label: "QR Center",
    href: "/dashboard/qr-center",
    icon: "qr",
    section: "operations",
    mobilePlacement: "more",
  },
  {
    label: "Depots",
    href: "/dashboard/depots",
    icon: "depots",
    section: "organize",
    mobilePlacement: "more",
  },
  {
    label: "Categories",
    href: "/dashboard/categories",
    icon: "categories",
    section: "organize",
    mobilePlacement: "more",
  },
  {
    label: "Suppliers",
    href: "/dashboard/suppliers",
    icon: "suppliers",
    section: "organize",
    mobilePlacement: "more",
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: "reports",
    section: "insights",
    mobilePlacement: "more",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: "settings",
    section: "system",
    mobilePlacement: "more",
  },
  {
    label: "Help Center",
    shortLabel: "Help",
    href: "/dashboard/help",
    icon: "help",
    section: "system",
    mobilePlacement: "more",
  },
];

export function isDashboardRouteActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getDashboardNavigationItem(pathname: string) {
  return (
    DASHBOARD_NAVIGATION.find((item) =>
      isDashboardRouteActive(pathname, item.href)
    ) || DASHBOARD_NAVIGATION[0]
  );
}
