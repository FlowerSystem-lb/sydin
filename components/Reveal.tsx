import type { CSSProperties, ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export default function Reveal({
  children,
  className = "",
  delay = 0,
}: RevealProps) {
  return (
    <div
      className={`sydin-reveal sydin-reveal-visible ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
