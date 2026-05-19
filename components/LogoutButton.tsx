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
      className="bg-red-500 hover:bg-red-600 transition px-5 py-3 rounded-2xl text-white text-xl font-semibold"
    >
      Logout
    </button>
  );
}