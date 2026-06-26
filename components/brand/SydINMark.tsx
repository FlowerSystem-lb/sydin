import Image from "next/image";

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

const sizePixels = {
  sm: 24,
  md: 36,
  lg: 48,
};

export default function SydINMark({
  className = "",
  size = "md",
  label = "SydIN",
  decorative = true,
}: SydINMarkProps) {
  return (
    <span
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
      className={`sydin-mark sydin-mark-${size} ${sizeClasses[size]} ${className}`}
    >
      <Image
        src="/brand/sydin-mark.svg"
        alt=""
        width={sizePixels[size]}
        height={sizePixels[size]}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
