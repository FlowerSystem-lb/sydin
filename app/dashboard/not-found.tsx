import {
  ActionButton,
  DashboardEmptyState,
  DashboardPageShell,
} from "@/components/dashboard/Workspace";

// 404 for dashboard routes — a deleted item or a stale bookmark lands here
// instead of on a bare browser error page, and keeps the shell so the customer
// is still inside the app.
export default function DashboardNotFound() {
  return (
    <DashboardPageShell>
      <DashboardEmptyState
        icon="search"
        title="Page not found"
        description="This page does not exist, or the item it pointed to was removed."
        action={
          <>
            <ActionButton href="/dashboard" icon="dashboard">
              Back to Dashboard
            </ActionButton>

            <ActionButton href="/dashboard/inventory" variant="secondary">
              Go to Inventory
            </ActionButton>
          </>
        }
      />
    </DashboardPageShell>
  );
}
