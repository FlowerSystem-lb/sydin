import type { HTMLAttributes } from "react";
import { cx } from "@/components/ui/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "muted" | "strong";
  interactive?: boolean;
}

export default function Card({
  className,
  tone = "default",
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        "ui-card",
        `ui-card-${tone}`,
        interactive && "ui-card-interactive",
        className
      )}
      {...props}
    />
  );
}

export function SectionCard({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx("ui-section-card", className)} {...props} />
  );
}
