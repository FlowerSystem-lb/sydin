import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { cx } from "@/components/ui/utils";

type WorkspaceWidth = "default" | "wide" | "compact";

const workspaceWidthClass: Record<WorkspaceWidth, string> = {
  default: "dashboard-workspace-default",
  wide: "dashboard-workspace-wide",
  compact: "dashboard-workspace-compact",
};

export function DashboardPageShell({
  children,
  className,
  width = "default",
}: {
  children: ReactNode;
  className?: string;
  width?: WorkspaceWidth;
}) {
  return (
    <div
      className={cx(
        "dashboard-page-shell",
        workspaceWidthClass[width],
        className
      )}
    >
      {children}
    </div>
  );
}

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("dashboard-page-header-card", className)}>
      <div className="dashboard-page-header-content">
        <div className="min-w-0">
          {eyebrow && <p className="dashboard-eyebrow">{eyebrow}</p>}
          <h1 className="dashboard-page-heading">{title}</h1>
          {description && (
            <p className="dashboard-page-copy">{description}</p>
          )}
        </div>
        {actions && <div className="dashboard-page-actions">{actions}</div>}
      </div>
    </section>
  );
}

export function DashboardCard({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLElement> & { interactive?: boolean }) {
  return (
    <section
      className={cx(
        "dashboard-card",
        interactive && "dashboard-card-interactive",
        className
      )}
      {...props}
    />
  );
}

export function DashboardToolbar({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={cx("dashboard-toolbar-card", className)} {...props} />;
}

export function FilterBar({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("dashboard-filter-bar", className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function FilterChip({
  active,
  count,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  count?: number | string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        "dashboard-filter-chip",
        active && "dashboard-filter-chip-active",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {count !== undefined && <span>{count}</span>}
    </button>
  );
}

export function DashboardNotice({
  tone = "info",
  children,
  className,
}: {
  tone?: "success" | "danger" | "warning" | "info";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("dashboard-notice", `dashboard-notice-${tone}`, className)}
    >
      {children}
    </div>
  );
}

export function ActionButton({
  href,
  icon,
  children,
  variant = "primary",
  className,
  disabled,
  ...props
}: HTMLAttributes<HTMLAnchorElement | HTMLButtonElement> & {
  href?: string;
  icon?: UiIconName;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
}) {
  const content = (
    <>
      {icon && <UiIcon name={icon} className="h-4 w-4" />}
      {children}
    </>
  );
  const sharedClassName = cx(
    "dashboard-action-button",
    `dashboard-action-button-${variant}`,
    disabled && "dashboard-action-button-disabled",
    className
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-disabled={disabled || undefined}
        className={sharedClassName}
        {...(props as HTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={sharedClassName}
      {...(props as HTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: UiIconName;
  href?: string;
}) {
  const content = (
    <>
      {icon && (
        <span className="dashboard-metric-icon">
          <UiIcon name={icon} className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0">
        <small>{label}</small>
        <strong>{value}</strong>
        {detail && <em>{detail}</em>}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="dashboard-metric-card dashboard-card-interactive">
        {content}
      </Link>
    );
  }

  return <div className="dashboard-metric-card">{content}</div>;
}

export function LoadingSkeletonGroup({
  count = 3,
  className,
  itemClassName,
}: {
  count?: number;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={cx("dashboard-skeleton-group", className)} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={cx("dashboard-skeleton-block", itemClassName)}
        />
      ))}
    </div>
  );
}

export function DashboardEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: UiIconName;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("dashboard-empty-state", className)}>
      {icon && (
        <span className="dashboard-empty-icon">
          <UiIcon name={icon} className="h-5 w-5" />
        </span>
      )}
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="dashboard-empty-action">{action}</div>}
    </div>
  );
}
