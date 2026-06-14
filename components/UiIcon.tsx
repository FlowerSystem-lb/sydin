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
  | "search"
  | "close"
  | "check"
  | "info"
  | "menu"
  | "chevron-down"
  | "chevron-up"
  | "chevron-left"
  | "chevron-right"
  | "trash"
  | "dashboard"
  | "depots"
  | "categories"
  | "suppliers"
  | "picklists"
  | "reports"
  | "settings"
  | "help"
  | "more"
  | "usage"
  | "appearance"
  | "logout";

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
      strokeWidth="1.75"
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
      {name === "close" && <path d="m6 6 12 12M18 6 6 18" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "info" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </>
      )}
      {name === "menu" && <path d="M4 7h16M4 12h16M4 17h16" />}
      {name === "chevron-down" && <path d="m6 9 6 6 6-6" />}
      {name === "chevron-up" && <path d="m6 15 6-6 6 6" />}
      {name === "chevron-left" && <path d="m15 6-6 6 6 6" />}
      {name === "chevron-right" && <path d="m9 6 6 6-6 6" />}
      {name === "trash" && (
        <>
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
          <path d="M10 11v5M14 11v5" />
        </>
      )}
      {name === "dashboard" && (
        <>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </>
      )}
      {name === "depots" && (
        <>
          <path d="M3 21V8l9-5 9 5v13" />
          <path d="M7 21v-8h10v8M7 9h.01M11 9h.01M15 9h.01" />
          <path d="M10 17h4" />
        </>
      )}
      {name === "categories" && (
        <>
          <path d="M4 5h6l2 2h8v12H4V5Z" />
          <path d="M8 11h8M8 15h5" />
        </>
      )}
      {name === "suppliers" && (
        <>
          <path d="M4 21v-8.5L12 8l8 4.5V21" />
          <path d="M8 10V5.5L12 3l4 2.5V10M8 21v-5h8v5" />
          <path d="M11 12h2" />
        </>
      )}
      {name === "picklists" && (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 3.5h6M9 9l1.5 1.5L13 8M14.5 10H16" />
          <path d="M9 15l1.5 1.5L13 14M14.5 16H16" />
        </>
      )}
      {name === "reports" && (
        <>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          <path d="m4 7 6-4 6 6 5-5" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.05a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.05A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3.05V3a2 2 0 1 1 4 0v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9c.1.62.48 1.15 1.05 1.42.17.08.35.12.5.12H21a2 2 0 1 1 0 4h-.05c-.65 0-1.25.37-1.55.96Z" />
        </>
      )}
      {name === "help" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.3 1-1.3 1.9M12 17h.01" />
        </>
      )}
      {name === "more" && (
        <>
          <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "usage" && (
        <>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        </>
      )}
      {name === "appearance" && (
        <>
          <path d="M12 3a9 9 0 1 0 9 9c0-1-.8-1.8-1.8-1.8h-2.4a2 2 0 0 1-2-2V5.2C14.8 4 13.6 3 12 3Z" />
          <circle cx="7.5" cy="11" r=".8" fill="currentColor" stroke="none" />
          <circle cx="9.5" cy="7.5" r=".8" fill="currentColor" stroke="none" />
          <circle cx="7.5" cy="15" r=".8" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "logout" && (
        <>
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M14 3h4a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4" />
        </>
      )}
    </svg>
  );
}
