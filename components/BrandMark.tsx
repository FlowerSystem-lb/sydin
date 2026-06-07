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
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="h-[58%] w-[58%]"
      >
        <path
          d="m6.5 10 9.5-5 9.5 5L16 15 6.5 10Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 10v11L16 27l9.5-6V10M16 15v12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="m11.2 7.5 9.6 5.1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
