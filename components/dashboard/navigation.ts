import type { UiIconName } from "@/components/UiIcon";

/* Sections follow the working day, not the database.
   "Operations" previously held six unrelated screens -- ordering from a
   supplier sat beside printing QR labels -- while Suppliers lived three
   sections away from Purchase Orders, which is the screen you are on when you
   need it. Split into the two things that actually happen: buying stock, and
   moving it. */
export type DashboardNavigationSection =
  | "workspace"
  | "buying"
  | "stock"
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
  buying: "Buying",
  stock: "Stock",
  organize: "Set up",
  insights: "Insights",
  system: "System",
};

/* Ordered by how often a working day touches them. Set up sits below the daily
   work, not above it: you create your categories and depots once and edit them
   rarely, so they do not earn a place near the top. */
export const DASHBOARD_SECTION_ORDER: DashboardNavigationSection[] = [
  "workspace",
  "buying",
  "stock",
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
    label: "Scanner",
    shortLabel: "Scan",
    href: "/dashboard/scanner",
    icon: "scan",
    section: "workspace",
    mobilePlacement: "primary",
  },
  {
    label: "Purchase Orders",
    shortLabel: "Orders",
    href: "/dashboard/purchase-orders",
    icon: "file",
    section: "buying",
    mobilePlacement: "primary",
  },
  {
    label: "Stock In",
    href: "/dashboard/receiving",
    icon: "download",
    section: "buying",
    mobilePlacement: "more",
  },
  {
    label: "Suppliers",
    href: "/dashboard/suppliers",
    icon: "suppliers",
    section: "buying",
    mobilePlacement: "more",
  },
  {
    label: "Stock Movements",
    shortLabel: "Movements",
    href: "/dashboard/stock-movements",
    icon: "movement",
    section: "stock",
    mobilePlacement: "more",
  },
  {
    label: "Stock Counts",
    shortLabel: "Counts",
    href: "/dashboard/stock-counts",
    icon: "layers",
    section: "stock",
    mobilePlacement: "more",
  },
  {
    label: "Pick Lists",
    shortLabel: "Picking",
    href: "/dashboard/pick-lists",
    icon: "picklists",
    section: "stock",
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
    label: "Depots",
    href: "/dashboard/depots",
    icon: "depots",
    section: "organize",
    mobilePlacement: "more",
  },
  {
    label: "QR Center",
    href: "/dashboard/qr-center",
    icon: "qr",
    section: "organize",
    mobilePlacement: "more",
  },
  {
    label: "Alerts",
    href: "/dashboard/alerts",
    icon: "alert",
    section: "insights",
    mobilePlacement: "more",
  },
  {
    label: "Activity",
    href: "/dashboard/activity",
    icon: "clock",
    section: "insights",
    mobilePlacement: "primary",
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: "reports",
    section: "insights",
    mobilePlacement: "more",
  },
  {
    label: "Import & Export",
    shortLabel: "Data",
    href: "/dashboard/import-export",
    icon: "sheet",
    section: "system",
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
    label: "Help",
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
