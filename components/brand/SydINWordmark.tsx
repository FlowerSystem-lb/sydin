export type SydINWordmarkVariant =
  | "theme"
  | "light-background"
  | "dark-background"
  | "monochrome";

interface SydINWordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: SydINWordmarkVariant;
  label?: string;
}

const sizeClasses = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

const sydColorClasses: Record<SydINWordmarkVariant, string> = {
  theme: "text-[var(--text-primary)]",
  "light-background": "text-[#0b1f3a]",
  "dark-background": "text-white",
  monochrome: "text-current",
};

export default function SydINWordmark({
  className = "",
  size = "md",
  variant = "theme",
  label = "SydIN",
}: SydINWordmarkProps) {
  const monochrome = variant === "monochrome";

  return (
    <span
      aria-label={label}
      className={`inline-flex items-baseline whitespace-nowrap font-extrabold leading-none tracking-[-0.045em] ${sizeClasses[size]} ${sydColorClasses[variant]} ${className}`}
    >
      <span aria-hidden="true">Syd</span>
      <span
        aria-hidden="true"
        className={`ml-[0.04em] text-[0.92em] ${
          monochrome ? "text-current" : "text-[#12b8d6]"
        }`}
      >
        IN
      </span>
    </span>
  );
}
