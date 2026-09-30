import "server-only";

/* Billing emails (phase 34, 30 Sep 2026): renew soon, grace started, plan
   ended, payment receipt, and a test. Same look as the sign-in emails
   (emails/build.mjs): grey page, white card, the SydIN gradient bar and logo,
   one clear message, a details box, and the Help / Terms / Privacy footer.
   Sent through Resend's API from billing@sydin.site; replies go to
   support@sydin.site, which ImprovMX forwards to Sayed's Gmail. */

const SITE = "https://www.sydin.site";
const LOGO = `${SITE}/email/sydin-logo.png`;
const FROM = "SydIN Billing <billing@sydin.site>";
const REPLY_TO = "support@sydin.site";
const WHATSAPP = "+961 76 075 247";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Beirut" });
}

const TONES = {
  info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a" },
  warn: { bg: "#fffbeb", border: "#fde68a", text: "#78350f" },
  danger: { bg: "#fef2f2", border: "#fecaca", text: "#7f1d1d" },
  ok: { bg: "#f0fdf4", border: "#bbf7d0", text: "#14532d" },
};

function callout(kind: keyof typeof TONES, title: string, text: string) {
  const tone = TONES[kind];
  return `<tr><td style="padding:20px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:${tone.bg};border:1px solid ${tone.border};border-radius:12px;"><tr><td style="padding:14px 16px;font-size:13px;line-height:20px;color:${tone.text};"><strong style="display:block;margin-bottom:2px;">${title}</strong>${text}</td></tr></table></td></tr>`;
}

function details(rows: [string, string][]) {
  return `<tr><td style="padding:20px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e4e4e7;border-radius:12px;">${rows
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:11px 16px;font-size:13px;color:#71717a;width:40%;${index ? "border-top:1px solid #f0f0f2;" : ""}">${label}</td><td style="padding:11px 16px;font-size:13px;color:#18181b;font-weight:600;${index ? "border-top:1px solid #f0f0f2;" : ""}">${value}</td></tr>`
    )
    .join("")}</table></td></tr>`;
}

function button(label: string, href: string) {
  return `<tr><td align="center" style="padding:24px 40px 0;"><a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${label}</a></td></tr>`;
}

function layout({ preheader, eyebrow, eyebrowColor = "#2563eb", title, intro, body }: {
  preheader: string;
  eyebrow: string;
  eyebrowColor?: string;
  title: string;
  intro: string;
  body: string;
}) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:18px;overflow:hidden;">
<tr><td style="height:5px;line-height:5px;font-size:0;background:#2563eb;background-image:linear-gradient(90deg,#0ea5e9,#2563eb,#7c3aed);">&nbsp;</td></tr>
<tr><td align="center" style="padding:32px 40px 8px;"><a href="${SITE}"><img src="${LOGO}" width="150" alt="SydIN" style="display:block;border:0;width:150px;height:auto;"></a></td></tr>
<tr><td align="center" style="padding:18px 40px 0;"><div style="font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${eyebrowColor};">${eyebrow}</div><h1 style="margin:8px 0 0;font-size:24px;line-height:31px;font-weight:700;color:#18181b;">${title}</h1></td></tr>
<tr><td align="center" style="padding:10px 40px 4px;font-size:15px;line-height:24px;color:#52525b;">${intro}</td></tr>
${body}
<tr><td style="padding:26px 40px 30px;font-size:13px;line-height:20px;color:#71717a;">Questions? Reply to this email or message us on WhatsApp at ${WHATSAPP}.</td></tr>
</table>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;"><tr><td align="center" style="padding:22px 20px 6px;font-size:12px;line-height:19px;color:#71717a;"><a href="${SITE}/dashboard/help" style="color:#52525b;text-decoration:none;font-weight:600;">Help Center</a> &middot; <a href="${SITE}/contact" style="color:#52525b;text-decoration:none;font-weight:600;">Contact</a> &middot; <a href="${SITE}/terms" style="color:#52525b;text-decoration:none;font-weight:600;">Terms</a> &middot; <a href="${SITE}/privacy" style="color:#52525b;text-decoration:none;font-weight:600;">Privacy</a></td></tr>
<tr><td align="center" style="padding:6px 20px 0;font-size:12px;line-height:19px;color:#a1a1aa;">SydIN &middot; Inventory and orders for wholesale businesses<br>You get this because you have a paid SydIN plan.</td></tr></table>
</td></tr></table></body></html>`;
}

const HOW_TO_PAY = callout(
  "info",
  "How to pay",
  `Send the amount by <strong>Whish Money</strong> or <strong>OMT</strong> to ${WHATSAPP} (receiver: SydIN Tech), or USDT (TRC20). Then send us the receipt on WhatsApp. Your plan continues as soon as we confirm it.`
);

const BILLING_URL = `${SITE}/dashboard/settings?section=billing`;

function planName(plan: string) {
  return plan === "pro" ? "Pro" : plan === "standard" ? "Standard" : "Free";
}

export function renewSoonEmail(to: string, business: string, plan: string, paidUntil: string): EmailMessage {
  const name = planName(plan);
  const date = formatDate(paidUntil);
  return {
    to,
    subject: `Your SydIN ${name} plan renews on ${date}`,
    text: `Hello ${business}, your SydIN ${name} plan is paid until ${date}. Pay before then to keep going without a break: Whish Money or OMT to ${WHATSAPP}, then send us the receipt on WhatsApp. Plan & billing: ${BILLING_URL}`,
    html: layout({
      preheader: `Your ${name} plan is paid until ${date}.`,
      eyebrow: "Renewal reminder",
      title: `Your ${name} plan renews soon`,
      intro: `Hello <strong style="color:#18181b;">${escapeHtml(business)}</strong>, your plan is paid until <strong style="color:#18181b;">${date}</strong>. Pay before then to keep going without a break.`,
      body: details([["Plan", name], ["Paid until", date]]) + HOW_TO_PAY + button("Open Plan & billing", BILLING_URL),
    }),
  };
}

export function graceStartEmail(to: string, business: string, plan: string, paidUntil: string, graceEnd: string): EmailMessage {
  const name = planName(plan);
  const end = formatDate(graceEnd);
  return {
    to,
    subject: `Action needed: your SydIN ${name} plan ended — 3 days to pay`,
    text: `Hello ${business}, your SydIN ${name} plan ended on ${formatDate(paidUntil)}. You keep full access until ${end}. Pay before then to keep ${name}: Whish Money or OMT to ${WHATSAPP}, then send the receipt on WhatsApp. Your data is safe. ${BILLING_URL}`,
    html: layout({
      preheader: `You keep full access until ${end}. Pay before then to keep ${name}.`,
      eyebrow: "Payment due",
      eyebrowColor: "#b45309",
      title: "You have 3 days to pay",
      intro: `Hello <strong style="color:#18181b;">${escapeHtml(business)}</strong>, your ${name} plan ended on ${formatDate(paidUntil)}. You still have full access until <strong style="color:#18181b;">${end}</strong>.`,
      body:
        callout("warn", "What happens next", `If we don't receive the payment by ${end}, your account moves to the Free plan's limits. <strong>Nothing is deleted</strong> &mdash; paying brings ${name} back instantly.`) +
        HOW_TO_PAY +
        button("Pay now", BILLING_URL),
    }),
  };
}

export function endedEmail(to: string, business: string, plan: string): EmailMessage {
  const name = planName(plan);
  return {
    to,
    subject: `Your SydIN ${name} plan has ended — your data is safe`,
    text: `Hello ${business}, your SydIN ${name} plan has ended, so your account now uses the Free plan's limits. All your data is safe: every item, invoice and customer is still there. Pay any time to get ${name} back instantly: ${BILLING_URL}`,
    html: layout({
      preheader: "You're on Free limits now. All your data is kept.",
      eyebrow: "Plan ended",
      eyebrowColor: "#b91c1c",
      title: `Your ${name} plan has ended`,
      intro: `Hello <strong style="color:#18181b;">${escapeHtml(business)}</strong>, your account now uses the Free plan's limits.`,
      body:
        callout("ok", "All your data is safe", "Every item, photo, invoice, customer and report is still in your account. Nothing was deleted.") +
        callout("info", "Get it back instantly", `Pay by Whish Money or OMT to ${WHATSAPP} and send us the receipt on WhatsApp. ${name} comes back the moment we confirm it.`) +
        button(`Renew ${name}`, BILLING_URL),
    }),
  };
}

export function receiptEmail(
  to: string,
  business: string,
  payment: { plan: string; months: number; amount: number; currency: string; method: string | null; reference: string | null; period_start: string; period_end: string; paid_at: string; id: number }
): EmailMessage {
  const name = planName(payment.plan);
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency || "USD" }).format(payment.amount);
  const rows: [string, string][] = [
    ["Receipt", `#${String(payment.id).padStart(5, "0")}`],
    ["Date", formatDate(payment.paid_at)],
    ["Plan", `${name} · ${payment.months} month${payment.months === 1 ? "" : "s"}`],
    ["Period", `${formatDate(payment.period_start)} – ${formatDate(payment.period_end)}`],
    ["Paid by", escapeHtml(payment.method || "—")],
    ["Amount", amount],
  ];
  if (payment.reference) rows.splice(5, 0, ["Reference", escapeHtml(payment.reference)]);
  return {
    to,
    subject: `Payment received — SydIN ${name} until ${formatDate(payment.period_end)}`,
    text: `Thank you, ${business}. We received ${amount} for SydIN ${name} (${payment.months} month(s)). Your plan is active until ${formatDate(payment.period_end)}. Receipt #${String(payment.id).padStart(5, "0")}.`,
    html: layout({
      preheader: `Thank you. ${name} is active until ${formatDate(payment.period_end)}.`,
      eyebrow: "Payment received",
      eyebrowColor: "#15803d",
      title: "Thank you for your payment",
      intro: `Hello <strong style="color:#18181b;">${escapeHtml(business)}</strong>, your ${name} plan is active until <strong style="color:#18181b;">${formatDate(payment.period_end)}</strong>.`,
      body: details(rows) + button("View payment history", BILLING_URL),
    }),
  };
}

export function testEmail(to: string): EmailMessage {
  return {
    to,
    subject: "SydIN billing emails are working",
    text: "This is a test from SydIN admin. Automatic billing emails are connected.",
    html: layout({
      preheader: "Automatic billing emails are connected.",
      eyebrow: "Test",
      eyebrowColor: "#15803d",
      title: "Billing emails are working",
      intro: "This test came from SydIN admin. Renewal reminders, payment-due notices and receipts will look like this.",
      body: callout("ok", "All set", "Replies to this email go to support@sydin.site."),
    }),
  };
}

/** Send through Resend's API. Returns false (never throws) when the key is
    missing or Resend refuses, so a failed email never breaks a payment. */
export async function sendEmail(message: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [message.to],
        reply_to: REPLY_TO,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, error: `Resend ${response.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "send failed" };
  }
}

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/* ---- Owner notifications (phase 35): low stock + weekly summary ---------- */

export function lowStockEmail(
  to: string,
  business: string,
  items: { name: string; quantity: number; threshold: number; unit: string }[],
  total: number
): EmailMessage {
  const shown = items.slice(0, 15);
  const rows: [string, string][] = shown.map((item) => [
    escapeHtml(item.name),
    `${item.quantity} ${escapeHtml(item.unit)} <span style="color:#a1a1aa;font-weight:400;">(alert at ${item.threshold})</span>`,
  ]);
  const more = total > shown.length ? `<tr><td align="center" style="padding:12px 40px 0;font-size:13px;color:#71717a;">and ${total - shown.length} more</td></tr>` : "";
  return {
    to,
    subject: `${total} item${total === 1 ? "" : "s"} running low at ${business}`,
    text: `Hello ${business}, ${total} item(s) reached their low-stock level: ${items
      .slice(0, 15)
      .map((item) => `${item.name} (${item.quantity} ${item.unit})`)
      .join(", ")}. Open SydIN to reorder: ${SITE}/dashboard/alerts`,
    html: layout({
      preheader: `${total} item${total === 1 ? "" : "s"} need reordering.`,
      eyebrow: "Low stock",
      eyebrowColor: "#b45309",
      title: `${total} item${total === 1 ? " is" : "s are"} running low`,
      intro: `Hello <strong style="color:#18181b;">${escapeHtml(business)}</strong>, these reached their low-stock level. Reorder before a customer asks.`,
      body: details(rows) + more + button("See low stock in SydIN", `${SITE}/dashboard/alerts`),
    }).replace("You get this because you have a paid SydIN plan.", "You asked for low-stock alerts. Turn them off in Settings &gt; My profile."),
  };
}

export function weeklySummaryEmail(
  to: string,
  business: string,
  currency: string,
  stats: { invoices: number; sold: number; received: number; owed: number; lowItems: number; from: string; to: string }
): EmailMessage {
  const money = (value: number) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  };
  const range = `${formatDate(stats.from)} – ${formatDate(stats.to)}`;
  return {
    to,
    subject: `Your week at ${business}: ${money(stats.sold)} sold`,
    text: `Week ${range}: ${stats.invoices} invoice(s), ${money(stats.sold)} sold, ${money(stats.received)} received, ${money(stats.owed)} owed by customers, ${stats.lowItems} item(s) low. ${SITE}/dashboard`,
    html: layout({
      preheader: `${money(stats.sold)} sold, ${money(stats.received)} received this week.`,
      eyebrow: "Weekly summary",
      title: "Your week in SydIN",
      intro: `Hello <strong style="color:#18181b;">${escapeHtml(business)}</strong>, here is ${range}.`,
      body:
        details([
          ["Invoices issued", String(stats.invoices)],
          ["Sold", money(stats.sold)],
          ["Payments received", money(stats.received)],
          ["Customers owe you", money(stats.owed)],
          ["Items running low", String(stats.lowItems)],
        ]) + button("Open your Overview", `${SITE}/dashboard`),
    }).replace("You get this because you have a paid SydIN plan.", "You asked for a weekly summary. Turn it off in Settings &gt; My profile."),
  };
}
