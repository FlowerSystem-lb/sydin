import { notFound } from "next/navigation";

// Catches any /dashboard/* URL that doesn't match a real page (deleted item
// link, typo, stale bookmark). Without this, Next can't match the dashboard
// layout at all for an unknown path and falls back to the bare framework 404
// — no sidebar, no way back. This route exists only to hand off to
// app/dashboard/not-found.tsx, which renders inside the normal app shell.
export default function DashboardCatchAll() {
  notFound();
}
