interface WordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function Wordmark({
  className = "",
  size = "md",
}: WordmarkProps) {
  const sizeClass =
    size === "lg"
      ? "text-3xl"
      : size === "sm"
        ? "text-xl"
        : "text-2xl";

  return (
    <span
      className={`inline-flex items-baseline font-black tracking-tight text-white ${sizeClass} ${className}`}
    >
      Syd
      <span className="brand-chip ml-0.5 rounded-md px-1.5 py-0.5 text-[0.72em] font-black leading-none">
        IN
      </span>
    </span>
  );
}
