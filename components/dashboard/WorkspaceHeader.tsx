import type { ReactNode } from "react";
import { cx } from "@/components/ui/utils";

interface WorkspaceHeaderProps {
  section: string;
  title: string;
  description?: string;
  /**
   * Page-level actions rendered as an organized button bar at the top right.
   * Pass ui Button components or links styled with buttonClassName so every
   * page shares the same smooth button system.
   */
  actions?: ReactNode;
  /** Optional context block (step strips, status chips) shown next to actions. */
  aside?: ReactNode;
  className?: string;
}

export default function WorkspaceHeader({
  section,
  title,
  description,
  actions,
  aside,
  className,
}: WorkspaceHeaderProps) {
  return (
    <section className={cx("workspace-header", className)}>
      <div className="workspace-header-copy">
        <p className="workspace-header-eyebrow">{section}</p>
        <h1 className="workspace-header-title">{title}</h1>
        {description && (
          <p className="workspace-header-description">{description}</p>
        )}
      </div>
      {aside && <div className="workspace-header-aside">{aside}</div>}
      {actions && (
        <div className="workspace-header-actions" aria-label="Page actions">
          {actions}
        </div>
      )}
    </section>
  );
}
