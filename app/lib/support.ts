export const SYDIN_SUPPORT_EMAIL = "support@sydin.app";
export const SYDIN_WHATSAPP_NUMBER = "96176075247";
export const SYDIN_WHATSAPP_DISPLAY = "+961 76 075 247";

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
