"use client";

import { supabase } from "@/app/lib/supabase";

interface LogoutButtonProps {
  variant?: "default" | "compact" | "icon";
}

export default function LogoutButton({
  variant = "default",
}: LogoutButtonProps) {
  const handleLogout = async () => {
    await supabase.auth.signOut();

    window.location.href = "/login";
  };

  const icon = (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M14 3h4a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4" />
    </svg>
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-200/10 bg-white/[0.04] text-slate-400 transition hover:border-red-300/20 hover:bg-red-400/10 hover:text-red-100"
        aria-label="Logout"
        title="Logout"
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        variant === "compact"
          ? "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-sky-200/10 bg-white/[0.035] px-2.5 py-2 text-xs font-semibold text-slate-400 transition hover:border-red-300/20 hover:bg-red-400/10 hover:text-red-100"
          : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-400/25 bg-red-500/15 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/25"
      }
    >
      {icon}
      Logout
    </button>
  );
}
