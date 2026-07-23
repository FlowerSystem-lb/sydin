"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import DashboardShell from "@/components/dashboard/DashboardShell";
import MobileShellWrapper from "@/components/mobile/MobileShellWrapper";
import ThemeProvider from "@/components/ThemeProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    id: string;
    email?: string | null;
  } | null>(null);

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

        setUser({
          id: session.user.id,
          email: session.user.email,
        });
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
      <ThemeProvider>
        <div className="liquid-bg flex min-h-screen items-center justify-center px-4 text-theme-primary">
          <div className="glass-panel px-7 py-6 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-2xl bg-[#2563eb]/25" />

            <p className="text-lg font-bold">
              Preparing your workspace
            </p>

            <p className="mt-1 text-sm text-theme-secondary">
              Checking your secure session.
            </p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (!user) return null;

  return (
    <ThemeProvider>
      <MobileShellWrapper userId={user.id}>
        <DashboardShell userId={user.id} email={user.email}>
          {children}
        </DashboardShell>
      </MobileShellWrapper>
    </ThemeProvider>
  );
}
