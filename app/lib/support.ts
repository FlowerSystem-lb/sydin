export const SYDIN_SUPPORT_EMAIL = "support@sydin.site";
export const SYDIN_WHATSAPP_NUMBER = "96171289391";
export const SYDIN_WHATSAPP_DISPLAY = "+961 71 289 391";

function normalizeContext(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
}

export function buildSupportMailtoUrl({
  businessName,
  planName,
  subject = "SydIN support request",
}: {
  businessName?: string | null;
  planName?: string | null;
  subject?: string;
} = {}) {
  const safeBusinessName = normalizeContext(businessName);
  const safePlanName = normalizeContext(planName);
  const context = [
    safeBusinessName ? `Business: ${safeBusinessName}` : "",
    safePlanName ? `Plan: ${safePlanName}` : "",
  ].filter(Boolean);
  const body = [
    "Hello SydIN Support,",
    "",
    "I need help with:",
    "",
    ...context,
  ].join("\n");

  return `mailto:${SYDIN_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

export function buildSupportWhatsAppUrl({
  businessName,
  planName,
}: {
  businessName?: string | null;
  planName?: string | null;
} = {}) {
  const safeBusinessName = normalizeContext(businessName);
  const safePlanName = normalizeContext(planName);
  const message = [
    "Hello SydIN Support, I need help with my account.",
    safeBusinessName ? `Business: ${safeBusinessName}.` : "",
    safePlanName ? `Plan: ${safePlanName}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `https://wa.me/${SYDIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    message
  )}`;
}

/* How customers pay for a plan (phase 32). The same details as
   /request-plan; shown in Settings > Plan & billing. */
export const SYDIN_PAYMENT_RECEIVER = "SydIN Tech";
export const SYDIN_WHISH_NUMBER = "96176075247";
export const SYDIN_OMT_NUMBER = "96176075247";
export const SYDIN_USDT_NETWORK = "USDT TRC20";
export const SYDIN_USDT_ADDRESS = "TYwWogiC9f2aHcidDQcyspTPj9S5TDZaDs";

/** WhatsApp message a customer sends after paying. */
export function buildPaymentWhatsAppUrl({
  businessName,
  planName,
  cycle,
  email,
}: {
  businessName?: string | null;
  planName: string;
  cycle: "monthly" | "yearly";
  email?: string | null;
}) {
  const message = [
    `Hello SydIN, I paid for the ${planName} plan (${cycle}).`,
    businessName ? `Business: ${normalizeContext(businessName)}.` : "",
    email ? `Account email: ${normalizeContext(email)}.` : "",
    "Here is my receipt:",
  ]
    .filter(Boolean)
    .join(" ");
  return `https://wa.me/${SYDIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
