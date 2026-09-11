import type { UiIconName } from "@/components/UiIcon";

/* Sections follow the business, not the database.

   The previous shape put Sales, Purchase Orders, Stock In, Pick Lists and
   Stock Counts behind one "Workflows" door. Tidy, but it failed the one test
   a sidebar has to pass: a depot owner with a delivery on the floor asking
   "where do I receive this?" could not see the answer. Every inventory tool a
   small business actually runs on -- Zoho, Sortly, Cin7, Odoo -- names the
   operations in the sidebar and groups them by what the business is doing:
   buying, selling, controlling stock. So does this one now.

   "Insight" is deliberately not called Reports: it holds Reports today and
   is where Activity and stock history already live inside it. */
export type DashboardNavigationSection =
  | "workspace"
  | "buying"
  | "selling"
  | "stock"
  | "insight"
  | "account";

export interface DashboardNavigationItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: UiIconName;
  section: DashboardNavigationSection;
  mobilePlacement: "primary" | "more";
}

/* Headings the user reads, not the ones the database would pick. Every one
   is a plain word that survives translation into Arabic. */
export const DASHBOARD_SECTION_LABELS: Record<
  DashboardNavigationSection,
  string
> = {
  workspace: "Daily work",
  buying: "Buying",
  selling: "Selling",
  stock: "Stock control",
  insight: "Insight",
  account: "Settings & help",
};

/* Ordered by how a working day runs: look at the shop, receive what came in,
   sell, then tidy the stock, then read the numbers. Set-up lists (Depots,
   Categories) sit with stock control -- you edit them rarely and they are
   about the stock, not about the account. */
export const DASHBOARD_SECTION_ORDER: DashboardNavigationSection[] = [
  "workspace",
  "buying",
  "selling",
  "stock",
  "insight",
  "account",
];

export const DASHBOARD_NAVIGATION: DashboardNavigationItem[] = [
  /* ---- Daily work ------------------------------------------------------ */
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
    /* A list you ACT on -- something is running out and you reorder it. It
       is the start of the buying workflow, but it is read every morning, so
       it stays with the daily work. */
    label: "Alerts",
    href: "/dashboard/alerts",
    icon: "alert",
    section: "workspace",
    mobilePlacement: "more",
  },

  /* ---- Buying ---------------------------------------------------------- */
  {
    label: "Purchase Orders",
    shortLabel: "Orders",
    href: "/dashboard/purchase-orders",
    icon: "cart",
    section: "buying",
    mobilePlacement: "more",
  },
  {
    /* "Receiving" in the URL and in the code; "Stock In" to the user, the
       words a depot uses. Primary on the phone: receiving happens standing
       at the delivery, and it is the one workflow that is mostly done on a
       phone rather than at the desk. */
    label: "Stock In",
    href: "/dashboard/receiving",
    icon: "stock-in",
    section: "buying",
    mobilePlacement: "primary",
  },
  {
    /* Suppliers sit with buying because that is the screen you are on when
       you need them -- three sections away was where they used to live. */
    label: "Suppliers",
    href: "/dashboard/suppliers",
    icon: "suppliers",
    section: "buying",
    mobilePlacement: "more",
  },

  /* ---- Selling --------------------------------------------------------- */
  {
    label: "Sales",
    href: "/dashboard/sales",
    icon: "receipt",
    section: "selling",
    mobilePlacement: "more",
  },
  {
    label: "Pick Lists",
    href: "/dashboard/pick-lists",
    icon: "picklists",
    section: "selling",
    mobilePlacement: "more",
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: "customers",
    section: "selling",
    mobilePlacement: "more",
  },

  /* ---- Stock control --------------------------------------------------- */
  {
    label: "Stock Counts",
    shortLabel: "Counts",
    href: "/dashboard/stock-counts",
    icon: "clipboard",
    section: "stock",
    mobilePlacement: "more",
  },
  {
    /* Back in the sidebar. It is the audit trail -- every quantity change
       with a reason and a reference -- and an audit trail you have to know
       the URL of is not one. */
    label: "Stock Movements",
    shortLabel: "Movements",
    href: "/dashboard/stock-movements",
    icon: "movement",
    section: "stock",
    mobilePlacement: "more",
  },
  {
    label: "Depots",
    href: "/dashboard/depots",
    icon: "depots",
    section: "stock",
    mobilePlacement: "more",
  },
  {
    label: "Categories",
    href: "/dashboard/categories",
    icon: "categories",
    section: "stock",
    mobilePlacement: "more",
  },

  /* ---- Insight --------------------------------------------------------- */
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: "reports",
    section: "insight",
    mobilePlacement: "more",
  },

  /* ---- Settings & help ------------------------------------------------- */
  {
    /* QR Center and Import & Export are deliberately not here. Sayed: open
       import from Inventory, like an internal page of it. Both already had a
       doorway from Inventory itself -- Import & Export from the ... menu, QR
       Center from bulk-select -- so a second, parallel entry in the sidebar was
       what made Inventory feel split across two places instead of one. */
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

/**
 * Undefined when the route isn't in the sidebar (Workflows, Activity, QR
 * Center, Import & Export, Add Item, Search). This used to fall back to
 * `DASHBOARD_NAVIGATION[0]`, so every such page told you it was "Overview"
 * in the top bar while you were standing on it. The honest answer is to say
 * "no match" and let the caller name the page from its own route.
 */
export function getDashboardNavigationItem(pathname: string) {
  return DASHBOARD_NAVIGATION.find((item) =>
    isDashboardRouteActive(pathname, item.href)
  );
}
