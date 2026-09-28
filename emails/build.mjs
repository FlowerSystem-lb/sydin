// Builds SydIN's auth emails for Supabase (Authentication > Emails).
//
//   node emails/build.mjs
//
// Writes one HTML file per template into emails/templates/, plus
// emails/preview.html (every email with sample values, for looking at).
// Sayed pastes each template into Supabase; subjects are in emails/README.md.
//
// Design (28 Sep 2026, Sayed: "professional like companies, logo clear,
// motion, policy, alert and danger"): one layout for every email -- grey
// page, white card, the SydIN gradient bar, the logo, one clear message, the
// code in a big box, a security note, and a footer with Help / Terms /
// Privacy. Email apps are old HTML engines, so it is table-based with inline
// styles. Motion (card rising in, the gradient bar shimmering, the code box
// breathing) is in a <style> block: Apple Mail and iOS Mail play it; Gmail
// and Outlook drop it and show the still design -- nothing depends on it.
//
// Supabase fills {{ .Token }}, {{ .Email }}, {{ .NewEmail }}, {{ .OldEmail }},
// {{ .Provider }} when it sends.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = "https://www.sydin.site";
const LOGO = `${SITE}/email/sydin-logo.png`;

const tone = {
  info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a", icon: "&#128274;" }, // lock
  warn: { bg: "#fffbeb", border: "#fde68a", text: "#78350f", icon: "&#9888;&#65039;" }, // warning
  danger: { bg: "#fef2f2", border: "#fecaca", text: "#7f1d1d", icon: "&#9888;&#65039;" },
  ok: { bg: "#f0fdf4", border: "#bbf7d0", text: "#14532d", icon: "&#10003;" },
};

function codeBox(token) {
  return `
          <tr>
            <td align="center" style="padding:8px 40px 6px;">
              <div class="sy-code" style="display:inline-block;padding:18px 28px;border-radius:14px;background:#f5f7ff;border:1px solid #dbe3ff;font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;color:#1d4ed8;">${token}</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 40px 4px;font-size:13px;line-height:20px;color:#71717a;">
              This code works for <strong style="color:#3f3f46;">10 minutes</strong> and only once.
            </td>
          </tr>`;
}

function callout(kind, title, text) {
  const t = tone[kind];
  return `
          <tr>
            <td style="padding:22px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:${t.bg};border:1px solid ${t.border};border-radius:12px;">
                <tr>
                  <td valign="top" style="padding:14px 0 14px 16px;width:26px;font-size:16px;line-height:22px;">${t.icon}</td>
                  <td style="padding:14px 16px 14px 8px;font-size:13px;line-height:20px;color:${t.text};">
                    <strong style="display:block;font-size:13px;margin-bottom:2px;">${title}</strong>${text}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function button(label, href, kind = "primary") {
  const bg = kind === "danger" ? "#dc2626" : "#2563eb";
  return `
          <tr>
            <td align="center" style="padding:24px 40px 0;">
              <a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${bg};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>
            </td>
          </tr>`;
}

function detail(rows) {
  return `
          <tr>
            <td style="padding:20px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e4e4e7;border-radius:12px;">
                ${rows
                  .map(
                    ([k, v], i) => `<tr>
                  <td style="padding:11px 16px;font-size:13px;color:#71717a;${i ? "border-top:1px solid #f0f0f2;" : ""}width:38%;">${k}</td>
                  <td style="padding:11px 16px;font-size:13px;color:#18181b;font-weight:600;${i ? "border-top:1px solid #f0f0f2;" : ""}word-break:break-all;">${v}</td>
                </tr>`
                  )
                  .join("\n                ")}
              </table>
            </td>
          </tr>`;
}

function layout({ preheader, eyebrow, eyebrowColor = "#2563eb", title, intro, body, why }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<style>
  @keyframes syRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes syShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
  @keyframes syBreathe { 0%, 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); } 50% { box-shadow: 0 0 0 6px rgba(37,99,235,0.10); } }
  .sy-card { animation: syRise 600ms cubic-bezier(.2,.7,.2,1) both; }
  .sy-bar { background: linear-gradient(90deg,#0ea5e9,#2563eb,#7c3aed,#2563eb,#0ea5e9) !important; background-size: 200% 100% !important; animation: syShimmer 6s linear infinite; }
  .sy-code { animation: syBreathe 2.6s ease-in-out 700ms infinite; }
  @media (prefers-reduced-motion: reduce) { .sy-card, .sy-bar, .sy-code { animation: none !important; } }
  @media (max-width: 600px) {
    .sy-pad { padding-left: 22px !important; padding-right: 22px !important; }
    .sy-code { font-size: 28px !important; letter-spacing: 7px !important; padding: 14px 18px !important; }
  }
  a { color: #2563eb; }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="sy-card" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:18px;overflow:hidden;">
          <tr>
            <td class="sy-bar" style="height:5px;line-height:5px;font-size:0;background:#2563eb;background-image:linear-gradient(90deg,#0ea5e9,#2563eb,#7c3aed);">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:32px 40px 8px;">
              <a href="${SITE}" style="text-decoration:none;"><img src="${LOGO}" width="150" height="68" alt="SydIN" style="display:block;border:0;width:150px;height:auto;"></a>
            </td>
          </tr>
          <tr>
            <td align="center" class="sy-pad" style="padding:18px 40px 0;">
              <div style="font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${eyebrowColor};">${eyebrow}</div>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:31px;font-weight:700;color:#18181b;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td align="center" class="sy-pad" style="padding:10px 40px 18px;font-size:15px;line-height:24px;color:#52525b;">${intro}</td>
          </tr>
${body}
          <tr>
            <td class="sy-pad" style="padding:26px 40px 30px;font-size:13px;line-height:20px;color:#71717a;">${why}</td>
          </tr>
        </table>

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
          <tr>
            <td align="center" style="padding:22px 20px 6px;font-size:12px;line-height:19px;color:#71717a;">
              <a href="${SITE}/dashboard/help" style="color:#52525b;text-decoration:none;font-weight:600;">Help Center</a>
              &nbsp;&middot;&nbsp;
              <a href="${SITE}/contact" style="color:#52525b;text-decoration:none;font-weight:600;">Contact</a>
              &nbsp;&middot;&nbsp;
              <a href="${SITE}/terms" style="color:#52525b;text-decoration:none;font-weight:600;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="${SITE}/privacy" style="color:#52525b;text-decoration:none;font-weight:600;">Privacy</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:6px 20px 0;font-size:12px;line-height:19px;color:#a1a1aa;">
              SydIN &middot; Inventory and orders for wholesale businesses<br>
              This is an account security email, so it can't be unsubscribed from.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

const NEVER_SHARE = callout(
  "warn",
  "Never share this code.",
  "SydIN staff will never ask you for it &mdash; not by phone, WhatsApp or email. Anyone who has it can get into this account."
);
const IF_NOT_YOU_IGNORE =
  "Didn't ask for this? You can ignore this email &mdash; nothing changes without the code. If you keep getting these, <a href=\"" +
  SITE +
  "/contact\">tell us</a>.";
const IF_NOT_YOU_ACT = (what) =>
  callout(
    "danger",
    "Wasn't you?",
    `Someone may have access to your account. Reset your password now and <a href="${SITE}/contact" style="color:#7f1d1d;font-weight:600;">contact us</a> &mdash; ${what}`
  );

const templates = [
  {
    file: "01-confirm-signup.html",
    supabase: "Confirm sign up",
    subject: "{{ .Token }} is your SydIN verification code",
    html: layout({
      preheader: "Your SydIN code is {{ .Token }}. It works for 10 minutes.",
      eyebrow: "Verify your email",
      title: "Welcome to SydIN",
      intro: "Enter this code in SydIN to finish creating your account for <strong style=\"color:#18181b;\">{{ .Email }}</strong>.",
      body: codeBox("{{ .Token }}") + NEVER_SHARE,
      why: IF_NOT_YOU_IGNORE,
    }),
  },
  {
    file: "02-reset-password.html",
    supabase: "Reset password",
    subject: "{{ .Token }} is your SydIN password reset code",
    html: layout({
      preheader: "Use {{ .Token }} to choose a new SydIN password.",
      eyebrow: "Password reset",
      title: "Reset your password",
      intro: "Someone asked to reset the password for <strong style=\"color:#18181b;\">{{ .Email }}</strong>. Enter this code on the SydIN reset page, then choose a new password.",
      body: codeBox("{{ .Token }}") + NEVER_SHARE,
      why: "Didn't ask to reset your password? Ignore this email &mdash; your password stays the same. If this keeps happening, <a href=\"" + SITE + "/contact\">tell us</a>.",
    }),
  },
  {
    file: "03-magic-link.html",
    supabase: "Magic link",
    subject: "{{ .Token }} is your SydIN sign-in code",
    html: layout({
      preheader: "Your SydIN sign-in code is {{ .Token }}.",
      eyebrow: "Sign in",
      title: "Your sign-in code",
      intro: "Enter this code in SydIN to sign in as <strong style=\"color:#18181b;\">{{ .Email }}</strong>.",
      body: codeBox("{{ .Token }}") + NEVER_SHARE,
      why: IF_NOT_YOU_IGNORE,
    }),
  },
  {
    file: "04-change-email.html",
    supabase: "Change email address",
    subject: "{{ .Token }} confirms your new SydIN email",
    html: layout({
      preheader: "Confirm {{ .NewEmail }} as your SydIN email with {{ .Token }}.",
      eyebrow: "Email change",
      title: "Confirm your new email",
      intro: "Enter this code in SydIN to change your account email from <strong style=\"color:#18181b;\">{{ .Email }}</strong> to <strong style=\"color:#18181b;\">{{ .NewEmail }}</strong>.",
      body: codeBox("{{ .Token }}") + NEVER_SHARE,
      why: "Didn't ask for this? Ignore this email and your account email stays the same &mdash; then <a href=\"" + SITE + "/forgot-password\">change your password</a> to be safe.",
    }),
  },
  {
    file: "05-reauthentication.html",
    supabase: "Reauthentication",
    subject: "{{ .Token }} is your SydIN security code",
    html: layout({
      preheader: "Confirm a sensitive change with {{ .Token }}.",
      eyebrow: "Confirm it's you",
      title: "Security check",
      intro: "You're making a sensitive change to your SydIN account. Enter this code to confirm it's really you.",
      body: codeBox("{{ .Token }}") + NEVER_SHARE,
      why: "Didn't start a change? Don't use this code, and <a href=\"" + SITE + "/forgot-password\">reset your password</a>.",
    }),
  },
  {
    file: "06-alert-password-changed.html",
    supabase: "Security notifications > Password changed",
    subject: "Your SydIN password was changed",
    html: layout({
      preheader: "The password for your SydIN account was just changed.",
      eyebrow: "Security alert",
      eyebrowColor: "#b45309",
      title: "Your password was changed",
      intro: "The password for your SydIN account was just changed.",
      body:
        detail([["Account", "{{ .Email }}"], ["What changed", "Password"]]) +
        callout("ok", "Was this you?", "Then you're all set &mdash; nothing else to do.") +
        IF_NOT_YOU_ACT("the sooner, the better.") +
        button("Reset my password", `${SITE}/forgot-password`, "danger"),
      why: "We send this every time the password changes, so you always know.",
    }),
  },
  {
    file: "07-alert-email-changed.html",
    supabase: "Security notifications > Email address changed",
    subject: "Your SydIN email was changed",
    html: layout({
      preheader: "The email on your SydIN account was changed.",
      eyebrow: "Security alert",
      eyebrowColor: "#b45309",
      title: "Your account email was changed",
      intro: "The email address you sign in to SydIN with was just changed.",
      body:
        detail([["Old email", "{{ .OldEmail }}"], ["New email", "{{ .Email }}"]]) +
        callout("ok", "Was this you?", "Then you're all set &mdash; sign in with the new email from now on.") +
        IF_NOT_YOU_ACT("we can help you get the account back."),
      why: "We send this to the old address too, so a change can never happen silently.",
    }),
  },
  {
    file: "08-alert-identity-linked.html",
    supabase: "Security notifications > Identity linked",
    subject: "A new sign-in method was added to your SydIN account",
    html: layout({
      preheader: "{{ .Provider }} can now be used to sign in to your SydIN account.",
      eyebrow: "Security alert",
      eyebrowColor: "#b45309",
      title: "New sign-in method added",
      intro: "You can now sign in to SydIN with <strong style=\"color:#18181b;\">{{ .Provider }}</strong>.",
      body:
        detail([["Account", "{{ .Email }}"], ["Added", "{{ .Provider }}"]]) +
        callout("ok", "Was this you?", "Then you're all set.") +
        IF_NOT_YOU_ACT("someone may have connected their own account to yours."),
      why: "We tell you whenever a way into your account is added or removed.",
    }),
  },
  {
    file: "09-alert-identity-unlinked.html",
    supabase: "Security notifications > Identity unlinked",
    subject: "A sign-in method was removed from your SydIN account",
    html: layout({
      preheader: "{{ .Provider }} can no longer be used to sign in to your SydIN account.",
      eyebrow: "Security alert",
      eyebrowColor: "#b45309",
      title: "Sign-in method removed",
      intro: "<strong style=\"color:#18181b;\">{{ .Provider }}</strong> can no longer be used to sign in to your SydIN account.",
      body:
        detail([["Account", "{{ .Email }}"], ["Removed", "{{ .Provider }}"]]) +
        callout("ok", "Was this you?", "Then you're all set.") +
        IF_NOT_YOU_ACT("especially if you can no longer sign in the usual way."),
      why: "We tell you whenever a way into your account is added or removed.",
    }),
  },
];

const out = join(here, "templates");
mkdirSync(out, { recursive: true });
for (const t of templates) writeFileSync(join(out, t.file), t.html);

// Preview: every email side by side with sample values.
const sample = (html) =>
  html
    .replaceAll("{{ .Token }}", "482915")
    .replaceAll("{{ .Email }}", "ahmed@flowerplus.com")
    .replaceAll("{{ .NewEmail }}", "ahmed.new@flowerplus.com")
    .replaceAll("{{ .OldEmail }}", "ahmed@flowerplus.com")
    .replaceAll("{{ .Provider }}", "Google");
const escapeAttr = (html) => html.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
const preview = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SydIN emails</title>
<style>body{margin:0;background:#e4e4e7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b}
header{padding:24px 16px 8px;text-align:center}h1{margin:0;font-size:20px}p{margin:6px 0 0;color:#52525b;font-size:14px}
main{display:grid;gap:28px;padding:20px 16px 48px;justify-items:center}
section{width:100%;max-width:620px}h2{font-size:14px;margin:0 0 4px}small{display:block;color:#71717a;margin-bottom:8px;font-size:12px}
iframe{width:100%;height:880px;border:0;border-radius:14px;background:#f4f4f5;box-shadow:0 8px 24px rgba(0,0,0,.08)}</style></head>
<body><header><h1>SydIN emails</h1><p>Sample values shown. Motion plays in Apple Mail and iOS Mail; Gmail shows the still design.</p></header><main>
${templates
  .map(
    (t) =>
      `<section><h2>${t.supabase}</h2><small>Subject: ${t.subject.replaceAll("{{ .Token }}", "482915")}</small><iframe title="${t.supabase}" srcdoc="${escapeAttr(sample(t.html))}"></iframe></section>`
  )
  .join("\n")}
</main></body></html>`;
writeFileSync(join(here, "preview.html"), preview);

// The paste list for Supabase.
const readme = `# SydIN auth emails

Generated by \`node emails/build.mjs\` — edit that file, not the templates.

In Supabase: **Authentication → Emails → Templates**. For each row, open the
template, set the **Subject**, paste the whole file into **Message body**, Save.

| Supabase template | Subject | File |
|---|---|---|
${templates.map((t) => `| ${t.supabase} | \`${t.subject}\` | templates/${t.file} |`).join("\n")}

Security notifications (06–09) must also be switched **on** in the same page.
The code emails expect **Email OTP Length = 6** (Authentication → Providers →
Email) — the app's code boxes are six digits.
`;
writeFileSync(join(here, "README.md"), readme);

console.log(`wrote ${templates.length} templates, preview.html, README.md`);
