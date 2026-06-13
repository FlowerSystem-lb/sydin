import type { HTMLAttributes } from "react";
import { cx } from "@/components/ui/utils";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export default function Badge({
  tone = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span className={cx("ui-badge", `ui-badge-${tone}`, className)} {...props} />
  );
}

export function StatusBadge({
  tone,
  className,
  ...props
}: BadgeProps & { tone: Exclude<BadgeTone, "neutral" | "accent"> }) {
  return (
    <Badge
      tone={tone}
      className={cx("ui-status-badge", className)}
      {...props}
    />
  );
}
