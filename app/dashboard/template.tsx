"use client";

// Templates (unlike layout.tsx) remount on every navigation, which is exactly
// what gives each dashboard page a fresh crossfade-in — the sidebar/header in
// layout.tsx stay mounted and untouched. Pure CSS animation, no new deps.
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="dashboard-route-transition">{children}</div>;
}
