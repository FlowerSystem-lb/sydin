"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isActive) return;

        if (!session) {
          router.push("/login");
          return;
        }

        setLoading(false);
      })
      .catch(() => {
        if (!isActive) return;

        router.push("/login");
      });

    return () => {
      isActive = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.2),_transparent_32%),linear-gradient(135deg,_#02030a_0%,_#050713_52%,_#02030a_100%)] px-4 text-white">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.045] px-7 py-6 text-center shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-2xl bg-indigo-400/25" />

          <p className="text-lg font-bold">
            Preparing your workspace
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Checking your secure session.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
