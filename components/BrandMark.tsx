import SydINMark from "@/components/brand/SydINMark";

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
}

export default function BrandMark({
  className = "",
  compact = false,
}: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`brand-mark ${compact ? "brand-mark-compact" : ""} ${className}`}
    >
      <SydINMark size="sm" />
    </span>
  );
}
