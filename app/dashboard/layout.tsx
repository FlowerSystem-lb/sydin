"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import {
  getBusinessContext,
  type BusinessContext as BusinessContextValue,
} from "@/app/lib/business";
import { BusinessProvider } from "@/components/dashboard/BusinessContext";
import TeamInviteBanner from "@/components/dashboard/TeamInviteBanner";
import DashboardShell from "@/components/dashboard/DashboardShell";
import MobileShellWrapper from "@/components/mobile/MobileShellWrapper";
import ThemeProvider from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui";
import MfaChallenge from "@/components/auth/MfaChallenge";

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
  const [business, setBusiness] = useState<BusinessContextValue | null>(null);
  /* Two-step verification (phase 35): an account with an authenticator app
     must enter its code before the workspace loads. The database will not
     serve its data until then anyway. */
  const [needsCode, setNeedsCode] = useState(false);
  const [codeTick, setCodeTick] = useState(0);

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

        return supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data: level }) => {
          if (!isActive) return;
          if (level?.nextLevel === "aal2" && level.currentLevel !== "aal2") {
            setNeedsCode(true);
            setLoading(false);
            return;
          }
          setNeedsCode(false);

          return getBusinessContext(session.user).then((context) => {
          if (!isActive) return;

          setBusiness(context);
          // The shell scopes notifications and plan usage by this id, so it
          // is the business, not the login (they differ for team members).
          setUser({
            id: context?.businessId ?? session.user.id,
            email: session.user.email,
          });
          setLoading(false);
          });
        });
      })
      .catch(() => {
        if (!isActive) return;

        router.push("/login");
      });

    return () => {
      isActive = false;
    };
  }, [router, codeTick]);

  if (loading) {
    return (
      <ThemeProvider>
        <div className="dashboard-gate flex min-h-screen items-center justify-center px-4 text-theme-primary">
          <div className="dashboard-gate-card px-7 py-6 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-lg bg-sydin-blue/25" />

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

  if (needsCode) {
    return (
      <ThemeProvider>
        <MfaChallenge
          onVerified={() => {
            setNeedsCode(false);
            setLoading(true);
            setCodeTick((tick) => tick + 1);
          }}
        />
      </ThemeProvider>
    );
  }

  if (!user) return null;

  return (
    <ThemeProvider>
      {/* Outside the shell so a toast survives the page under it unmounting
          -- "Item saved" must not disappear with the form that saved it. */}
      <ToastProvider>
        <BusinessProvider value={business}>
          <MobileShellWrapper userId={user.id}>
            <DashboardShell userId={user.id} email={user.email}>
              <TeamInviteBanner />
              {children}
            </DashboardShell>
          </MobileShellWrapper>
        </BusinessProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
