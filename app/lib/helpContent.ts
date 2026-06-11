export interface HelpGuide {
  title: string;
  description: string;
  href: string;
  action: string;
}

export interface HelpExpandableItem {
  title: string;
  body: string;
  href?: string;
  action?: string;
}

export const QUICK_GUIDES: HelpGuide[] = [
  {
    title: "Inventory basics",
    description:
      "Add products, review stock, search records, and open full item details.",
    href: "/dashboard/inventory",
    action: "Open Inventory",
  },
  {
    title: "Stock movements",
    description:
      "Use an item page to record stock in, stock out, adjustments, damaged, or lost quantities.",
    href: "/dashboard/inventory",
    action: "Choose an Item",
  },
  {
    title: "Depots",
    description:
      "Create locations for shops, storage rooms, warehouses, or event stock.",
    href: "/dashboard/depots",
    action: "Manage Depots",
  },
  {
    title: "Categories",
    description:
      "Create a consistent category list so inventory stays easier to filter and report.",
    href: "/dashboard/categories",
    action: "Manage Categories",
  },
  {
    title: "Suppliers",
    description:
      "Save vendor contact details and connect suppliers to relevant inventory items.",
    href: "/dashboard/suppliers",
    action: "Manage Suppliers",
  },
  {
    title: "Import and export",
    description:
      "Bring inventory in from CSV or Excel and use available export formats for backups and sharing.",
    href: "/dashboard/inventory/import",
    action: "Open Import",
  },
  {
    title: "Reports",
    description:
      "Review stock health, inventory value, movement totals, and operational trends.",
    href: "/dashboard/reports",
    action: "View Reports",
  },
  {
    title: "Pick Lists",
    description:
      "Prepare an order or event, track required quantities, and optionally deduct stock at completion.",
    href: "/dashboard/pick-lists",
    action: "Open Pick Lists",
  },
  {
    title: "Business settings and QR privacy",
    description:
      "Manage workspace branding and contact settings. Private inventory details remain protected from public QR pages.",
    href: "/dashboard/settings",
    action: "Open Settings",
  },
];

export const TROUBLESHOOTING_ITEMS: HelpExpandableItem[] = [
  {
    title: "I cannot add more inventory items",
    body:
      "Check your current item usage and plan limit. Existing records remain available after a downgrade, but adding new items is blocked when the current allowance is reached.",
    href: "/dashboard",
    action: "Check Plan Usage",
  },
  {
    title: "My import file does not pass validation",
    body:
      "Confirm the file is CSV or Excel, includes the required name and quantity columns, stays within the row and file limits, and uses supported unit values. The preview identifies each row that needs correction before anything is imported.",
    href: "/dashboard/inventory/import",
    action: "Review Import",
  },
  {
    title: "The camera or scanner will not start",
    body:
      "Allow camera access in the browser, use a secure connection, close other apps using the camera, and try the rear camera on mobile. Scanner availability also depends on the active plan.",
    href: "/dashboard/inventory",
    action: "Open Inventory",
  },
  {
    title: "An item image is missing",
    body:
      "Open the private item page and edit the item to upload a supported JPG, PNG, or WebP image. If an older image URL is unavailable, replace it with a new file.",
    href: "/dashboard/inventory",
    action: "Find the Item",
  },
  {
    title: "I need to correct a stock quantity",
    body:
      "Open the item and record an Adjustment stock movement with the correct final quantity. This keeps the change visible in stock movement history.",
    href: "/dashboard/inventory",
    action: "Open Inventory",
  },
  {
    title: "A feature is locked",
    body:
      "Locked tools show the plan required to use them. Your existing inventory is not deleted when plans change, and basic Help Center access remains available on every plan.",
    href: "/dashboard",
    action: "Review Current Plan",
  },
  {
    title: "What does a public QR page reveal?",
    body:
      "Public QR pages use a dedicated public identifier and expose only the approved public item view. Pick Lists, internal reports, private workspace records, and support activity are never added to public QR pages.",
  },
];

export const FAQ_ITEMS: HelpExpandableItem[] = [
  {
    title: "Does preparing a Pick List deduct stock?",
    body:
      "No. Draft and preparing Pick Lists do not reserve or deduct stock. Stock changes only when a fully prepared list is completed with the deduct-stock option.",
    href: "/dashboard/pick-lists",
    action: "Open Pick Lists",
  },
  {
    title: "Can completed Pick Lists be edited?",
    body:
      "No. Completed and cancelled Pick Lists are permanent read-only records. Use a new list or a separate stock movement when a later correction is needed.",
  },
  {
    title: "What happens after a plan downgrade?",
    body:
      "SydIN preserves existing records. If current usage is above the new plan allowance, relevant creation actions are blocked until usage returns below the limit or the plan is upgraded.",
  },
  {
    title: "Is my inventory public?",
    body:
      "Your dashboard inventory is private to your authenticated account. A public QR page is a separate limited view and does not provide access to the dashboard or internal operational data.",
  },
  {
    title: "How are paid plans activated?",
    body:
      "Standard and Pro use SydIN's manual early-access process. Submit a plan request, complete the agreed payment method, and the SydIN team activates the account after review.",
    href: "/request-plan",
    action: "Request a Plan",
  },
  {
    title: "How do exports work?",
    body:
      "Available export formats depend on the active plan. CSV remains the basic portable format, while paid plans add richer Excel and PDF options where offered.",
    href: "/dashboard/inventory",
    action: "Open Export Tools",
  },
];
