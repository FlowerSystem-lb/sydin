# SydIN — Product Principles & Decision Rules

The "how we decide" doc. When a choice isn't obvious, these principles break the tie. They
sit above any single feature. UI-specific rules live in [SYDIN_UI_RULES.md](SYDIN_UI_RULES.md);
this doc is about product judgment.

---

## Product principles

1. **Premium, not heavy.** SydIN feels like Linear/Stripe, never like a legacy ERP. Clean,
   compact, fast, visual, clickable. If a screen feels like an enterprise form dump, redesign it.
2. **Inventory is the core.** Item browsing and item data are the product's heart. Features
   that don't make managing physical things easier are lower priority.
3. **Foundation before flash.** Inventory, Categories, Item Details, Add/Edit must be stable
   before Scanner/QR/AI — no matter how exciting those are.
4. **One way to do a thing.** Reuse shared primitives; avoid parallel components that drift.
5. **Every screen has all its states.** Loading, empty, and error are part of "done," not extras.
6. **Mobile is a first-class product, not shrunk desktop.** Scan-first, thumb-friendly. See
   [SYDIN_MOBILE_ROADMAP.md](SYDIN_MOBILE_ROADMAP.md).
7. **Data integrity is sacred.** Stock changes only through real events (e.g. receiving
   finalized). Don't fake or shortcut the data model.
8. **Translation-ready.** Structure copy so i18n is possible later; avoid concatenated strings.
9. **Solo-founder economics.** Prefer free/low-cost, consolidated tools. Don't add a paid
   service when an existing one covers it. See [SYDIN_PAYMENTS_STRATEGY.md](SYDIN_PAYMENTS_STRATEGY.md).
10. **Ship in safe, reviewable steps.** Small sprints, plan-first for risky work, verify, commit.

---

## Decision rules (defaults Claude should apply)

- **Don't touch the untouchables** without an explicit, approved request: auth, Supabase
  logic, DB schema, routing, business logic, working behavior.
- **Plan Mode for risky or wide changes**; edit only after the plan is approved.
- **Prefer reuse over new code.** Search for an existing helper/component first.
- **Conservative over clever** when stabilizing existing work (e.g. Sprint 3B did annotate +
  dead-code-only, no risky reordering).
- **No scanner/QR detours** until the foundation sprints (4–7) are done.
- **Be strict, not agreeable.** If an idea is bad, risky, too early, too expensive, or
  distracting, say so plainly and explain why. Don't rubber-stamp.
- **Latest Claude models** for any AI features (see the `claude-api` reference).
- **Record meaningful decisions** in [SYDIN_DECISION_LOG.md](SYDIN_DECISION_LOG.md).

---

## When to push back (say "not yet" or "no")

Flag an idea as premature/risky when it:
- depends on data, modules, or events that don't exist yet;
- requires touching schema/auth/routing without a clear, scoped plan;
- adds a recurring cost the project doesn't need yet;
- competes for attention with an unfinished foundation sprint;
- looks impressive in a demo but doesn't make real inventory work easier.

Offer the smaller, safer version or the right sequence instead of a flat refusal.

---

## Feature Review Template

Run **every** new feature idea through this before it enters a sprint. Copy it into the
[SYDIN_DECISION_LOG.md](SYDIN_DECISION_LOG.md) or the backlog notes when reviewing.

1. **Problem it solves** — what real pain, for whom?
2. **Target user** — who specifically benefits?
3. **User workflow** — the step-by-step path through it.
4. **Where it lives in product** — which screen/module.
5. **Connected modules** — what it reads from / writes to.
6. **Desktop UX** — layout, primitives, states.
7. **Mobile UX** — scan-first / thumb-friendly considerations.
8. **Empty / loading / error states** — all three defined.
9. **Subscription tier** — free, paid, or enterprise (see payments doc).
10. **Technical complexity** — rough effort + unknowns.
11. **Risks** — data, auth, cost, scope, regression.
12. **Priority** — P0 / P1 / P2 / P3 (see [SYDIN_FEATURE_BACKLOG.md](SYDIN_FEATURE_BACKLOG.md)).
13. **Ship now or later** — and what must exist first.
