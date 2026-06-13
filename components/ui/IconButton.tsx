import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/components/ui/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "danger";
}

export default function IconButton({
  label,
  icon,
  className,
  size = "md",
  tone = "default",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "ui-icon-button",
        `ui-icon-button-${size}`,
        tone === "danger" && "ui-icon-button-danger",
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
