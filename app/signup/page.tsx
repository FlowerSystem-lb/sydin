"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const handleSignup = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const { error } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created");

    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <form
        onSubmit={handleSignup}
        className="w-[500px] bg-[#080808] border border-neutral-800 rounded-[30px] p-10"
      >
        <h1 className="text-5xl font-bold mb-10">
          Signup
        </h1>

        <div className="flex flex-col gap-6">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
          />

          <button
            type="submit"
            className="bg-white text-black py-5 rounded-2xl text-2xl font-semibold"
          >
            Create Account
          </button>
        </div>
      </form>
    </div>
  );
}