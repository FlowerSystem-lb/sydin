"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SubscriptionPlan } from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";

interface PlanCtaLinkProps {
  plan: SubscriptionPlan;
  className?: string;
  children: React.ReactNode;
}

function getPlanHref(plan: SubscriptionPlan, signedIn: boolean) {
  if (plan === "free") {
    return signedIn ? "/dashboard" : "/signup?plan=free";
  }

  if (signedIn) {
    return `/request-plan?plan=${plan}`;
  }

  const returnTo = `/request-plan?plan=${plan}`;
  return `/signup?plan=${plan}&returnTo=${encodeURIComponent(returnTo)}`;
}

export default function PlanCtaLink({
  plan,
  className,
  children,
}: PlanCtaLinkProps) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSignedIn(Boolean(data.session));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return (
    <Link href={getPlanHref(plan, signedIn)} className={className}>
      {children}
    </Link>
  );
}
