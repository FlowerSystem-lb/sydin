import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";

interface StateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: StateProps) {
  return (
    <Card className={cx("ui-state", className)}>
      {icon && <div className="ui-state-icon">{icon}</div>}
      <h3 className="ui-state-title">{title}</h3>
      <p className="ui-state-description">{description}</p>
      {action && <div className="ui-state-action">{action}</div>}
    </Card>
  );
}

export function ErrorState(props: StateProps) {
  return (
    <div role="alert">
      <EmptyState {...props} className={cx("ui-state-error", props.className)} />
    </div>
  );
}

export function LoadingSkeleton({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cx("ui-skeleton", className)}
    />
  );
}
