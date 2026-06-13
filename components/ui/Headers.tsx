import type { ReactNode } from "react";
import { cx } from "@/components/ui/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cx("ui-page-header", className)}>
      <div className="ui-page-header-content">
        <div className="min-w-0">
          {meta}
          {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
          <h1 className="ui-page-title">{title}</h1>
          {description && <p className="ui-page-description">{description}</p>}
        </div>
        {actions && <div className="ui-page-actions">{actions}</div>}
      </div>
    </header>
  );
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  id,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cx("ui-section-header", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <h2 id={id} className="ui-section-title">
          {title}
        </h2>
        {description && (
          <p className="ui-section-description">{description}</p>
        )}
      </div>
      {action && <div className="ui-section-action">{action}</div>}
    </div>
  );
}
