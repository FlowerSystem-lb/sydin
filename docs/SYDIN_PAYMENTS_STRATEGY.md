# SydIN — Payments & Billing Strategy

How SydIN gets paid, and how to choose tools without wasting the founder's limited budget.
Claude acts as a practical SaaS advisor here — **not** a legal/tax authority.

> ⚠️ **Not legal or tax advice.** Provider eligibility, fees, taxes, and regulations change and
> vary by country. Before committing, tell Sayed to **verify with the provider's current
> official docs** and, for legal/tax questions, a qualified professional. Do not state
> eligibility or tax claims as fact.

---

## Cost discipline (important)

Sayed is a solo, student founder and **cannot afford duplicate or unnecessary tools.** Prefer
free/low-cost and **consolidate**.

Current/known tools: VS Code · Git · Supabase · Next.js · Claude Code / Claude Project
(previously ChatGPT/Codex was used for planning/coding help). Before recommending any new paid
tool, check whether something already in the stack covers it, and say so.

---

## What already exists in the codebase

SydIN already has a **manual plan-request + admin-activation** flow:

- `app/request-plan/page.tsx` — user requests a plan.
- `app/admin/plan-requests/page.tsx` — founder reviews requests.
- `app/api/admin/plan-requests/*`, `app/api/admin/activate-plan/route.ts` — activation endpoints.
- `app/lib/subscription.ts`, `adminAuth.ts`, `supabaseAdmin.ts` — supporting logic.

This is a real asset: it means SydIN can take paying customers via **manual approval** before
any automated gateway is wired. **Do not modify this flow without an explicit approved sprint.**

---

## Strategy

1. **Manual approval first.** Lead with the existing request → approve → activate flow. It
   unblocks early revenue and fits markets where card/gateway access is limited
   (Lebanon/Syria-style). Keep it polished and reliable.
2. **Don't rush an automated gateway.** Choose one deliberately, after research.
3. **Crypto is optional and later** — not a launch priority.

### Automated gateway — candidates to research (don't pre-commit)

| Provider | Why consider | What to verify (current, official) |
|---|---|---|
| **Paddle** | Merchant-of-record; handles tax/VAT; good for solo SaaS | Country/account eligibility, fees, approval process |
| **Lemon Squeezy** | MoR; simple for indie SaaS | Eligibility for founder's country, fees, payout methods |
| **Stripe** | Most flexible, best DX | **Country availability** for the founder's account, payout support |
| **Others / regional** | May fit the region better | Availability + fees vs the above |

Decision factors: **region/account eligibility**, fees, payout method, tax handling (MoR vs
self-managed), and SaaS subscription support. **Apple Pay / Google Pay** availability depends on
the chosen provider — don't promise them independently.

---

## Target billing capabilities (eventual)

- Plan management (view/upgrade/downgrade).
- Invoices and payment history.
- Manual approval flow (kept as a first-class path).
- Clear plan tiers mapped to features (see tier column in
  [SYDIN_FEATURE_BACKLOG.md](SYDIN_FEATURE_BACKLOG.md)).
- Automated gateway **added later**, alongside (not replacing) manual approval.

---

## How Claude should advise on payments

- Be practical and budget-aware; respect the founder's country/account limitations.
- **Research current provider rules** when a decision is near — don't rely on memory of
  eligibility/fees, which change.
- Never make legal/tax claims as fact; route those to official sources / a professional.
- Never ask Sayed to paste card details, API keys, or service-role keys (see
  [SYDIN_FOUNDER_OPERATING_MANUAL.md](SYDIN_FOUNDER_OPERATING_MANUAL.md)).
- Log the final provider decision in [SYDIN_DECISION_LOG.md](SYDIN_DECISION_LOG.md).
