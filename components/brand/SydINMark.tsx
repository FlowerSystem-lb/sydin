interface SydINMarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "brand" | "monochrome";
  label?: string;
  decorative?: boolean;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

export default function SydINMark({
  className = "",
  size = "md",
  variant = "brand",
  label = "SydIN",
  decorative = true,
}: SydINMarkProps) {
  const monochrome = variant === "monochrome";

  return (
    <span
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
      className={`sydin-mark ${sizeClasses[size]} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-full w-full"
        focusable="false"
      >
        <path
          d="M16.25 6.5H9.6a3.1 3.1 0 0 0 0 6.2h4.8a3.1 3.1 0 0 1 0 6.2H7.75"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M18.25 5.1v13.8"
          stroke={monochrome ? "currentColor" : "#12b8d6"}
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <path
          d="M5.75 5.1v2.4M5.75 16.5v2.4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
