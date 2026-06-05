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

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-xs font-black text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
        aria-label="Logout"
        title="Logout"
      >
        Out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        variant === "compact"
          ? "rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
          : "rounded-2xl border border-red-400/25 bg-red-500/15 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/25"
      }
    >
      Logout
    </button>
  );
}
