import type { UiIconName } from "@/components/UiIcon";

/* Sections follow the working day, not the database.
   "Operations" previously held six unrelated screens -- ordering from a
   supplier sat beside printing QR labels -- while Suppliers lived three
   sections away from Purchase Orders, which is the screen you are on when you
   need it. Split into the two things that actually happen: buying stock, and
   moving it. */
export type DashboardNavigationSection =
  | "workspace"
  | "records"
  | "reports"
  | "account";

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
  records: "Records",
  reports: "Reports",
  account: "Account",
};

/* Ordered by how often a working day touches them. Set up sits below the daily
   work, not above it: you create your categories and depots once and edit them
   rarely, so they do not earn a place near the top. */
export const DASHBOARD_SECTION_ORDER: DashboardNavigationSection[] = [
  "workspace",
  "records",
  "reports",
  "account",
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
    /* NOT "primary". The mobile bar renders every primary item AND a hardcoded
       Scan button, so listing Scanner here put "Scan" in the bar twice. The
       raised button is the scanner on a phone; this link is the desktop route
       to the same place. */
    label: "Scanner",
    shortLabel: "Scan",
    href: "/dashboard/scanner",
    icon: "scan",
    section: "workspace",
    mobilePlacement: "more",
  },
  {
    /* One door for the five things that are the same KIND of thing: a process
       with steps that ends in a quantity changing. Sales, Purchase Orders,
       Stock In, Pick Lists and Stock Counts each had their own sidebar row,
       across three separate groups, competing with places you merely go. */
    label: "Workflows",
    href: "/dashboard/workflows",
    icon: "movement",
    section: "workspace",
    /* Takes the bottom-bar slot Activity used to hold. Activity is a history
       you read and now lives in Reports; Workflows is where selling, buying
       and counting start, which is what a thumb wants within reach. */
    mobilePlacement: "primary",
  },
  {
    /* Records: the lists you maintain rather than the jobs you run. Customers,
       Suppliers, Depots and Categories were spread across three groups while
       being the same kind of thing -- a directory you add to occasionally and
       then pick from everywhere else. Stock Movements and Activity left the
       sidebar entirely; both are histories, and Reports is where histories
       live now. */
    label: "Customers",
    href: "/dashboard/customers",
    icon: "suppliers",
    section: "records",
    mobilePlacement: "more",
  },
  {
    label: "Suppliers",
    href: "/dashboard/suppliers",
    icon: "suppliers",
    section: "records",
    mobilePlacement: "more",
  },
  {
    label: "Depots",
    href: "/dashboard/depots",
    icon: "depots",
    section: "records",
    mobilePlacement: "more",
  },
  {
    label: "Categories",
    href: "/dashboard/categories",
    icon: "categories",
    section: "records",
    mobilePlacement: "more",
  },
  {
    /* A list you ACT on -- something is running out and you reorder it -- so it
       sits with the daily work rather than with the things you read. */
    label: "Alerts",
    href: "/dashboard/alerts",
    icon: "alert",
    section: "workspace",
    mobilePlacement: "more",
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: "reports",
    section: "reports",
    mobilePlacement: "more",
  },
  {
    /* QR Center and Import & Export are deliberately not here. Sayed: open
       import from Inventory, like an internal page of it. Both already had a
       doorway from Inventory itself -- Import & Export from the ... menu, QR
       Center from bulk-select -- so a second, parallel entry in the sidebar was
       what made Inventory feel split across two places instead of one. Removing
       the sidebar copy leaves exactly one way in, and both pages now carry a
       "Back to Inventory" action so the round trip reads as one workspace. */
    label: "Settings",
    href: "/dashboard/settings",
    icon: "settings",
    section: "account",
    mobilePlacement: "more",
  },
  {
    label: "Help",
    href: "/dashboard/help",
    icon: "help",
    section: "account",
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
