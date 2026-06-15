import { useId } from "react";

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
  const id = useId().replace(/:/g, "");
  const ribbonId = `sydin-ribbon-${id}`;
  const uprightId = `sydin-upright-${id}`;
  const cubeTopId = `sydin-cube-top-${id}`;
  const cubeLeftId = `sydin-cube-left-${id}`;
  const cubeRightId = `sydin-cube-right-${id}`;

  return (
    <span
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
      className={`sydin-mark sydin-mark-${size} ${sizeClasses[size]} ${className}`}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="h-full w-full"
        focusable="false"
      >
        {!monochrome && (
          <defs>
            <linearGradient
              id={ribbonId}
              x1="7"
              y1="5"
              x2="20"
              y2="29"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#3977FF" />
              <stop offset=".28" stopColor="#8357FF" />
              <stop offset=".55" stopColor="#14D9FF" />
              <stop offset=".8" stopColor="#3977FF" />
              <stop offset="1" stopColor="#D64BFF" />
            </linearGradient>
            <linearGradient
              id={uprightId}
              x1="25"
              y1="8"
              x2="25"
              y2="26"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#22E8B6" />
              <stop offset=".48" stopColor="#14D9FF" />
              <stop offset="1" stopColor="#8357FF" />
            </linearGradient>
            <linearGradient
              id={cubeTopId}
              x1="13"
              y1="13"
              x2="19"
              y2="16"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#C7FAFF" />
              <stop offset=".5" stopColor="#14D9FF" />
              <stop offset="1" stopColor="#3977FF" />
            </linearGradient>
            <linearGradient
              id={cubeLeftId}
              x1="13"
              y1="15"
              x2="16"
              y2="21"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#8357FF" />
              <stop offset="1" stopColor="#D64BFF" />
            </linearGradient>
            <linearGradient
              id={cubeRightId}
              x1="19"
              y1="15"
              x2="16"
              y2="21"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#14D9FF" />
              <stop offset="1" stopColor="#3977FF" />
            </linearGradient>
          </defs>
        )}
        <path
          d="M19.8 5.15 10.3 9.5A4.35 4.35 0 0 0 8.2 15.3l9.45 7.15a2.25 2.25 0 0 1-.45 3.85L8.3 29.2"
          stroke={monochrome ? "currentColor" : `url(#${ribbonId})`}
          strokeWidth="5.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M25.05 9.15v16.1"
          stroke={monochrome ? "currentColor" : `url(#${uprightId})`}
          strokeWidth="5.35"
          strokeLinecap="round"
        />
        {monochrome ? (
          <path
            d="m16 12.75 3.25 1.85v3.75L16 20.25l-3.25-1.9V14.6L16 12.75Z"
            fill="currentColor"
          />
        ) : (
          <>
            <path
              d="m16 12.75 3.25 1.85L16 16.5l-3.25-1.9L16 12.75Z"
              fill={`url(#${cubeTopId})`}
            />
            <path
              d="M12.75 14.6 16 16.5v3.75l-3.25-1.9V14.6Z"
              fill={`url(#${cubeLeftId})`}
            />
            <path
              d="m19.25 14.6-3.25 1.9v3.75l3.25-1.9V14.6Z"
              fill={`url(#${cubeRightId})`}
            />
          </>
        )}
      </svg>
    </span>
  );
}
