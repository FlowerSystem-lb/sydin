"use client";

import { supabase } from "@/app/lib/supabase";

export default function LogoutButton() {
  const handleLogout = async () => {
    await supabase.auth.signOut();

    window.location.href = "/login";
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-2xl border border-red-400/25 bg-red-500/15 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/25"
    >
      Logout
    </button>
  );
}
