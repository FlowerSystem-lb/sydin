export type UiIconName =
  | "box"
  | "layers"
  | "alert"
  | "clock"
  | "upload"
  | "download"
  | "file"
  | "sheet"
  | "plus"
  | "scan"
  | "search";

export default function UiIcon({
  name,
  className = "h-5 w-5",
}: {
  name: UiIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "box" && (
        <>
          <path d="m4 7 8-4 8 4-8 4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7M12 11v10" />
        </>
      )}
      {name === "layers" && (
        <>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        </>
      )}
      {name === "alert" && (
        <>
          <path d="M10.3 3.7 2.8 17a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {name === "upload" && (
        <>
          <path d="M12 16V4M7 9l5-5 5 5" />
          <path d="M5 14v5h14v-5" />
        </>
      )}
      {name === "download" && (
        <>
          <path d="M12 4v12M7 11l5 5 5-5" />
          <path d="M5 20h14" />
        </>
      )}
      {name === "file" && (
        <>
          <path d="M6 2h8l4 4v16H6V2Z" />
          <path d="M14 2v5h5M9 13h6M9 17h6" />
        </>
      )}
      {name === "sheet" && (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h8M12 8v8" />
        </>
      )}
      {name === "plus" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </>
      )}
      {name === "scan" && (
        <>
          <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
          <path d="M7 12h10" />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </>
      )}
    </svg>
  );
}
