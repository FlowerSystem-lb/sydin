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
      className={`inline-flex items-baseline font-black tracking-[-0.045em] text-white ${sizeClass} ${className}`}
    >
      Syd
      <span className="ml-0.5 bg-gradient-to-br from-cyan-200 via-sky-300 to-indigo-300 bg-clip-text text-[0.92em] font-black text-transparent">
        IN
      </span>
    </span>
  );
}
