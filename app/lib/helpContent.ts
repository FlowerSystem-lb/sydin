/**
 * The Help Center's content, written from the product as it is -- every
 * step here is a button or page that exists. When a workflow changes, its
 * article changes in the same commit.
 *
 * Articles are grouped by what the business is doing (the same groups as the
 * sidebar), searchable by title, summary and keywords, and addressable by id
 * so a "What is this?" link on a page can open the right one:
 * /dashboard/help?article=receive-against-order
 */

export type HelpCategoryId =
  | "start"
  | "inventory"
  | "buying"
  | "selling"
  | "payments"
  | "stock"
  | "reports"
  | "settings"
  | "trouble";

export interface HelpCategory {
  id: HelpCategoryId;
  label: string;
  blurb: string;
}

export interface HelpArticle {
  id: string;
  category: HelpCategoryId;
  title: string;
  /** One sentence: the situation this answers. */
  summary: string;
  /** Numbered steps, in the order they happen. */
  steps: string[];
  /** A closing note: what to expect, or the trap to avoid. */
  note?: string;
  href?: string;
  action?: string;
  keywords?: string;
  /** Shown under "Most asked" when nothing is typed. */
  popular?: boolean;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "start", label: "Getting started", blurb: "The first hour with SydIN." },
  { id: "inventory", label: "Inventory", blurb: "Items, photos, codes, labels." },
  { id: "buying", label: "Buying & receiving", blurb: "Purchase orders and deliveries." },
  { id: "selling", label: "Selling", blurb: "Invoices, customers, pick lists." },
  { id: "payments", label: "Payments", blurb: "Money in, money out, what is owed." },
  { id: "stock", label: "Stock control", blurb: "Counts, movements, depots." },
  { id: "reports", label: "Reports & exports", blurb: "PDF, Excel, CSV." },
  { id: "settings", label: "Settings & plan", blurb: "Company, documents, limits." },
  { id: "trouble", label: "Troubleshooting", blurb: "When something looks wrong." },
];

export const HELP_ARTICLES: HelpArticle[] = [
  /* ---- Getting started ------------------------------------------------ */
  {
    id: "first-hour",
    category: "start",
    title: "Set up SydIN in an hour",
    summary: "The order to do things in so everything else falls into place.",
    steps: [
      "Settings > Company: your name, logo, address and currency. They print on every document.",
      "Depots: one per shop, warehouse or storage room.",
      "Categories: a short list you will actually filter by.",
      "Inventory > Add item, or Import to bring in a spreadsheet.",
      "Suppliers and Customers: the people you buy from and sell to.",
      "Then run the day: Purchase Orders, Stock In, Sales.",
    ],
    href: "/dashboard/settings",
    action: "Open Settings",
    popular: true,
  },
  {
    id: "where-things-live",
    category: "start",
    title: "Where do I go to…?",
    summary: "The sidebar is grouped by what the business is doing.",
    steps: [
      "Daily work: Overview, Inventory, Scanner, Alerts.",
      "Buying: Purchase Orders, Stock In, Suppliers.",
      "Selling: Sales, Pick Lists, Customers.",
      "Stock control: Stock Counts, Stock Movements, Depots, Categories.",
      "Insight: Reports. Settings & help at the bottom.",
    ],
    note: "The + Add button in the top bar starts the common jobs from anywhere.",
    keywords: "sidebar navigation menu find",
  },

  /* ---- Inventory ---------------------------------------------------------- */
  {
    id: "add-item",
    category: "inventory",
    title: "Add an item",
    summary: "One product or asset, with the details the rest of the app uses.",
    steps: [
      "Inventory > Add item (or + Add > New item).",
      "Name, quantity and unit are enough to start.",
      "Add a photo: a depot recognises the carton, not the SKU.",
      "Set cost and selling price so orders and invoices fill themselves in.",
      "Set a minimum stock level to get a low-stock alert.",
    ],
    href: "/dashboard/add-item",
    action: "Add an item",
    keywords: "product new create sku barcode photo",
    popular: true,
  },
  {
    id: "import-items",
    category: "inventory",
    title: "Import items from a spreadsheet",
    summary: "Bring in a whole catalogue from CSV or Excel.",
    steps: [
      "Inventory > … menu > Import & Export > Import.",
      "Download the template, fill it in, upload it.",
      "Every row is checked first; fix what is flagged, then confirm.",
    ],
    note: "Nothing is written until every row passes and you confirm.",
    href: "/dashboard/inventory/import",
    action: "Open Import",
    keywords: "csv excel upload bulk",
  },
  {
    id: "qr-labels",
    category: "inventory",
    title: "Print QR labels",
    summary: "A label on the shelf that opens the item on a phone.",
    steps: [
      "Inventory: select the items (tick boxes), then QR Center.",
      "Choose the label size, print the sheet.",
      "Scan a label with Scanner to open, adjust or move that item.",
    ],
    href: "/dashboard/qr-center",
    action: "Open QR Center",
    keywords: "barcode print sticker scan",
  },

  /* ---- Buying & receiving -------------------------------------------------- */
  {
    id: "create-purchase-order",
    category: "buying",
    title: "Order stock from a supplier",
    summary: "A purchase order records what you asked for, at what cost.",
    steps: [
      "Purchase Orders > New purchase order.",
      "Pick the supplier and the depot the goods should land in.",
      "Add inventory items (with photos) or a general purchase like a repair.",
      "Save. The order is now Ordered and shows under Deliveries expected.",
      "Export PDF to send it to the supplier.",
    ],
    note: "Use Save as draft if you have not placed the order yet.",
    href: "/dashboard/purchase-orders/new",
    action: "New purchase order",
    keywords: "po buy restock supplier",
    popular: true,
  },
  {
    id: "receive-against-order",
    category: "buying",
    title: "Receive a delivery against an order",
    summary: "What arrived becomes stock; what did not stays on the order.",
    steps: [
      "Stock In > Deliveries expected > Receive (or open the order and press Receive stock).",
      "Each line shows ordered, received so far, and what is arriving now -- lower a number if the van was short.",
      "Add a delivery note if you like, and a payment if you paid on delivery.",
      "Press Receive. Stock lines go straight into inventory.",
    ],
    note: "The order becomes Partially received until everything is in. If the supplier will never send the rest, tick Close the order after this delivery.",
    href: "/dashboard/receiving",
    action: "Open Stock In",
    keywords: "receiving goods received grn partial delivery van arrived",
    popular: true,
  },
  {
    id: "stock-in-without-order",
    category: "buying",
    title: "Stock In without a purchase order",
    summary: "Returns, corrections, or stock you bought on the spot.",
    steps: [
      "Stock In > fill in the delivery details (reference, source, depot).",
      "Pick the items and quantities that arrived.",
      "Review, then Finalize. Each item gets a Stock In movement.",
    ],
    note: "If it was ordered on a purchase order, receive it on the order instead so the order knows what is still to come.",
    href: "/dashboard/receiving",
    action: "Open Stock In",
    keywords: "rcv receive return",
  },
  {
    id: "low-stock-to-order",
    category: "buying",
    title: "From low stock to a purchase order",
    summary: "Reorder what is running out in two clicks.",
    steps: [
      "Alerts lists everything at or under its minimum.",
      "Select the items and choose Create purchase order.",
      "The order opens with those items already on it; set quantities and the supplier.",
    ],
    href: "/dashboard/alerts",
    action: "Open Alerts",
    keywords: "reorder minimum threshold running out",
  },

  /* ---- Selling ------------------------------------------------------------ */
  {
    id: "raise-invoice",
    category: "selling",
    title: "Sell and invoice a customer",
    summary: "An invoice takes the stock out and records what is owed.",
    steps: [
      "Sales > New invoice. Pick the customer (or add one on the spot).",
      "Add products; the price fills in from the item. Add a charge for delivery if needed.",
      "Save as draft, or Issue. Issuing deducts stock and locks the lines.",
      "Download PDF to hand over or send on WhatsApp.",
    ],
    note: "A draft can still be edited or deleted. Once issued, cancel it instead.",
    href: "/dashboard/sales/new",
    action: "New invoice",
    keywords: "sale sell bill customer",
    popular: true,
  },
  {
    id: "pick-lists",
    category: "selling",
    title: "Prepare an order with a pick list",
    summary: "Gather the goods for an order or event before anything is sold.",
    steps: [
      "Pick Lists > Create pick list, name it after the order or event.",
      "Add the items and required quantities; shortages are flagged.",
      "Tick lines as they are picked. Complete the list when the goods have gone out.",
    ],
    note: "Preparing does not change stock. Completing can, if you choose to deduct.",
    href: "/dashboard/pick-lists",
    action: "Open Pick Lists",
    keywords: "picking event order preparation",
  },
  {
    id: "customer-account",
    category: "selling",
    title: "See what a customer owes",
    summary: "Every invoice and the balance, in one place.",
    steps: [
      "Customers: each row shows Owes … or Settled.",
      "Press Account for invoiced, paid, still owes and every invoice.",
      "New invoice from there starts with the customer already chosen.",
    ],
    href: "/dashboard/customers",
    action: "Open Customers",
    keywords: "balance statement debt owed",
  },

  /* ---- Payments ---------------------------------------------------------- */
  {
    id: "record-customer-payment",
    category: "payments",
    title: "Record a payment from a customer",
    summary: "Part or all of an invoice, in cash, card or transfer.",
    steps: [
      "Sales > open the invoice.",
      "Payments > enter the amount and how it was paid > Record.",
      "The invoice reads Partially paid until the balance is zero, then Paid.",
    ],
    note: "Remove a payment from the same list if it was entered by mistake; the balance recalculates.",
    href: "/dashboard/sales",
    action: "Open Sales",
    keywords: "partial paid cash transfer money in",
    popular: true,
  },
  {
    id: "record-supplier-payment",
    category: "payments",
    title: "Record a payment to a supplier",
    summary: "What you paid on an order, whenever you paid it.",
    steps: [
      "Purchase Orders > open the order > Record payment.",
      "Or tick Paid something on delivery while receiving.",
      "The order shows Order total, Paid and Still owe.",
    ],
    href: "/dashboard/purchase-orders",
    action: "Open Purchase Orders",
    keywords: "bill supplier money out owe",
  },
  {
    id: "what-is-owed",
    category: "payments",
    title: "What is owed, both ways",
    summary: "Overview answers it every morning.",
    steps: [
      "Overview > Customers owe you: every open invoice, with the overdue count.",
      "Overview > You owe suppliers: every order not fully paid.",
      "Action required lists overdue invoices and deliveries still expected.",
    ],
    href: "/dashboard",
    action: "Open Overview",
    keywords: "overdue outstanding balance",
  },

  /* ---- Stock control ---------------------------------------------------- */
  {
    id: "stock-count",
    category: "stock",
    title: "Count the shelves",
    summary: "Compare what is on the shelf with what the app thinks.",
    steps: [
      "Stock Counts > Start count. Choose all items, a category or a depot.",
      "Enter what you counted -- by hand or by scanning labels.",
      "Review the differences, then finalize. Each difference becomes an adjustment movement.",
    ],
    href: "/dashboard/stock-counts",
    action: "Open Stock Counts",
    keywords: "inventory count audit stocktake",
  },
  {
    id: "adjust-stock",
    category: "stock",
    title: "Correct a quantity",
    summary: "Breakage, loss, a miscount -- with a reason that stays on record.",
    steps: [
      "Open the item > Record movement (or scan its label).",
      "Choose Stock In, Stock Out, Adjustment or Damaged / Lost, and a note.",
      "Stock Movements lists every change with before, after and the reason.",
    ],
    href: "/dashboard/stock-movements",
    action: "Open Stock Movements",
    keywords: "movement history audit trail damaged lost",
  },
  {
    id: "move-between-depots",
    category: "stock",
    title: "Move stock between depots",
    summary: "From the warehouse to the shop, tracked.",
    steps: [
      "Open the item, or scan it, and choose Transfer.",
      "Pick the destination depot and the quantity.",
      "Both depots' quantities update, and the transfer appears in the item's history.",
    ],
    href: "/dashboard/depots",
    action: "Open Depots",
    keywords: "transfer location warehouse shop",
  },

  /* ---- Reports & exports ------------------------------------------------ */
  {
    id: "documents-branding",
    category: "reports",
    title: "What prints on invoices and orders",
    summary: "Your logo, address, tax number, terms and footer.",
    steps: [
      "Settings > Company: fill in address, tax / registration number, payment terms and a footer line.",
      "Every invoice and purchase order PDF prints them, with item photos and page numbers.",
    ],
    href: "/dashboard/settings",
    action: "Open Company settings",
    keywords: "pdf logo header footer vat",
  },
  {
    id: "export-inventory",
    category: "reports",
    title: "Export the inventory",
    summary: "Excel for analysis, PDF for a printed list, CSV for another system.",
    steps: [
      "Inventory > … menu > Export, or Reports for the stock and value reports.",
      "Excel keeps numbers as numbers, so totals and filters work in the sheet.",
    ],
    href: "/dashboard/reports",
    action: "Open Reports",
    keywords: "excel csv pdf download backup",
  },

  /* ---- Settings & plan ---------------------------------------------------- */
  {
    id: "plans",
    category: "settings",
    title: "Plans and limits",
    summary: "What each plan allows, and how to move up.",
    steps: [
      "Settings > Billing & Plan shows your plan and where you stand against its limits.",
      "Compare plans and request an upgrade from there; we confirm by email or WhatsApp.",
    ],
    note: "Nothing is charged automatically. Payment is arranged with you directly.",
    href: "/dashboard/settings?section=billing",
    action: "Open Billing & Plan",
    keywords: "upgrade price free standard pro limit locked",
  },
  {
    id: "public-pages",
    category: "settings",
    title: "What a public QR page shows",
    summary: "Name, photo and description -- never stock, prices or suppliers.",
    steps: [
      "A QR label opens the item's public page for anyone who scans it.",
      "Settings > Company > Public pages decides whether your contact details show there.",
    ],
    href: "/dashboard/settings",
    action: "Open Company settings",
    keywords: "privacy qr public share",
  },

  /* ---- Troubleshooting --------------------------------------------------- */
  {
    id: "camera",
    category: "trouble",
    title: "The scanner will not start",
    summary: "The browser needs permission to use the camera.",
    steps: [
      "Allow the camera when the browser asks; on a phone, check the site's permissions in settings.",
      "Use HTTPS (the live site) -- browsers block the camera on plain http.",
      "Pair your phone from Scanner > Use my phone if the computer has no camera.",
    ],
    href: "/dashboard/scanner",
    action: "Open Scanner",
    keywords: "camera permission scan phone",
  },
  {
    id: "wrong-quantity",
    category: "trouble",
    title: "A quantity is wrong",
    summary: "Find out why before changing it.",
    steps: [
      "Open the item's history: every change lists before, after, reason and the document behind it.",
      "If a receipt or invoice was entered twice, cancel or delete that document rather than editing the number.",
      "If the shelf is simply different, record an Adjustment with a note.",
    ],
    href: "/dashboard/stock-movements",
    action: "Open Stock Movements",
    keywords: "incorrect stock mismatch",
  },
  {
    id: "database-update",
    category: "trouble",
    title: "A page asks for a database update",
    summary: "New features sometimes need a one-time SQL file to be run.",
    steps: [
      "The message names the file, e.g. sql/phase-23-partial-receiving.sql.",
      "Open Supabase > SQL Editor, paste the file's contents, Run.",
      "Refresh the page. Nothing else changes until you do this.",
    ],
    keywords: "sql supabase migration missing table",
  },
  {
    id: "locked-feature",
    category: "trouble",
    title: "A feature is locked",
    summary: "It belongs to a higher plan.",
    steps: [
      "The panel says which plan includes it.",
      "Settings > Billing & Plan > Compare plans to request it.",
    ],
    href: "/dashboard/settings?section=billing",
    action: "Open Billing & Plan",
    keywords: "upgrade locked plan",
  },
];

/** Case-insensitive match on title, summary, steps and keywords. */
export function searchHelpArticles(query: string, articles = HELP_ARTICLES) {
  const needle = query.trim().toLowerCase();
  if (!needle) return articles;
  const terms = needle.split(/\s+/);
  return articles.filter((article) => {
    const haystack = [
      article.title,
      article.summary,
      article.note || "",
      article.keywords || "",
      ...article.steps,
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
