"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      setLoading(true);

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      window.location.href =
        "/dashboard";
    } catch {
      alert("Login failed");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="w-[500px] bg-[#080808] border border-neutral-800 rounded-[30px] p-10"
      >
        <h1 className="text-5xl font-bold mb-10">
          Login
        </h1>

        <div className="flex flex-col gap-6">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="bg-[#dfe5f1] text-black rounded-2xl px-6 py-5 text-2xl outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="bg-[#dfe5f1] text-black rounded-2xl px-6 py-5 text-2xl outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black py-5 rounded-2xl text-2xl font-semibold"
          >
            {loading
              ? "Loading..."
              : "Login"}
          </button>
        </div>
      </form>
    </div>
  );
}
