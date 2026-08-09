---
description: Run the pre-sprint checklist from the Founder Operating Manual before starting SydIN UI/code work
---

Follow the "Before any code sprint" checklist from `docs/SYDIN_FOUNDER_OPERATING_MANUAL.md`:

1. Run `git status` and confirm the working tree is clean. If it isn't, stop and tell the user
   what's uncommitted — do not proceed until they decide what to do with it.
2. Confirm the current branch. UI work belongs on a feature branch, not directly on `main`. If on
   `main`, tell the user and ask whether to create a branch first.
3. Read `CLAUDE.md` and the `docs/` brain (`SYDIN_PRODUCT_BRAIN.md`, `SYDIN_ROADMAP.md`, the tail
   of `SYDIN_SPRINT_LOG.md`, `SYDIN_UI_RULES.md`, `SYDIN_FOUNDER_OPERATING_MANUAL.md`) if not
   already loaded this session.
4. If the requested change is risky or wide (touches many files, changes shared components, or is
   ambiguous in scope), use Plan Mode before editing.

Report the result of steps 1–2 plainly before doing any other work. Do not silently skip a failed
check.
