import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/components/ui/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  leadingIcon?: ReactNode;
}

export function buttonClassName({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cx(
    "ui-button",
    `ui-button-${variant}`,
    `ui-button-${size}`,
    className
  );
}

export default function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Working...",
  leadingIcon,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="ui-button-spinner" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        <>
          {leadingIcon}
          {children}
        </>
      )}
    </button>
  );
}
