import {
  DashboardPageShell,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";

// Shown by Next while a dashboard route's code/data is still arriving. Without
// it a slow route is a dead click: the sidebar stays lit on the old page and
// nothing acknowledges the tap. Renders inside the dashboard layout, so the
// shell and navigation stay put and only the page body swaps to skeletons —
// skeletons, not a spinner, per UI_RULES §25.
export default function DashboardLoading() {
  return (
    <DashboardPageShell>
      {/* LoadingSkeletonGroup is aria-hidden, so announce the wait separately. */}
      <p role="status" className="sr-only">
        Loading page
      </p>

      <LoadingSkeletonGroup count={1} itemClassName="min-h-32" />
      <LoadingSkeletonGroup
        count={4}
        className="md:grid-cols-2 xl:grid-cols-4"
        itemClassName="min-h-28"
      />
      <LoadingSkeletonGroup count={1} itemClassName="min-h-72" />
    </DashboardPageShell>
  );
}
