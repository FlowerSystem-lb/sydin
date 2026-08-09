---
description: Run the post-sprint checklist from the Founder Operating Manual — verification gate, UI review, drafts the sprint/decision log entries
---

Follow the "After any code sprint" checklist from `docs/SYDIN_FOUNDER_OPERATING_MANUAL.md`:

1. Run the verification gate, in order, and report each result plainly (never hide a failure):
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run build`
   All three must pass before continuing. If any fails, stop and fix it before drafting the log
   entry.
2. Remind the user (once) that lint/tsc/build cannot catch visual regressions — verify visually via
   the Browser pane if a preview is available and the change is observable there.
3. Re-check the change against `docs/SYDIN_UI_RULES.md`: page anatomy, visual style, motion,
   component reuse, loading/empty/error states.
4. Draft a new entry for `docs/SYDIN_SPRINT_LOG.md`, appended above the "Append the next sprint
   entry below this line" marker, in the established format: a `##` heading naming the
   feature/fix, **Scope**, what was **Delivered** (with file references), how it was **Verified**
   (exact command results, not "should work"), and **Untouchables** confirming nothing outside
   scope changed. Match the terse, measured, no-hype tone of existing entries — cite actual
   measurements when a layout/sizing claim is made, not estimates.
5. If a non-obvious decision was made (a tradeoff, a rejected alternative, a naming/architecture
   choice), draft a matching entry for `docs/SYDIN_DECISION_LOG.md`.
6. Do **not** commit automatically. Present the drafted log entries and a suggested commit
   message, and wait for the user to confirm before running `git add` / `git commit`.
