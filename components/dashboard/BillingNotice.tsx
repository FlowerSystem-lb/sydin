"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import { useBusiness } from "@/components/dashboard/BusinessContext";
import {
  formatPlanName,
  getGraceEnd,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";

/* A thin bar over every dashboard page when a paid plan needs paying
   (phase 32): a week before the end, during the 3-day grace, and after it
   lapses to Free. Owner and admins only -- staff can't pay. "Later" hides a
   renewal reminder for the day; the grace and expired bars stay. */

const DISMISS_KEY = "sydin:billing-notice-dismissed";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function BillingNotice() {
  const business = useBusiness();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const canPay = business?.role === "owner" || business?.role === "admin";
  const businessId = business?.businessId;

  useEffect(() => {
    if (!canPay || !businessId) return;
    let live = true;
    void getUserSubscription(businessId).then((loaded) => {
      if (live) setSubscription(loaded);
    });
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a per-device dismissal once
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === today());
    } catch {
      /* storage blocked: just show it */
    }
    return () => {
      live = false;
    };
  }, [canPay, businessId]);

  const state = subscription?.billing_state;
  if (!subscription || !state || !["due_soon", "grace", "expired"].includes(state)) return null;
  if (state === "due_soon" && dismissed) return null;

  const plan = formatPlanName(subscription.paid_plan ?? subscription.plan);
  const text =
    state === "due_soon"
      ? `Your ${plan} plan renews on ${formatDate(subscription.paid_until)}.`
      : state === "grace"
        ? `Your ${plan} plan ended. Pay by ${formatDate(getGraceEnd(subscription.paid_until))} to keep it.`
        : `Your ${plan} plan has ended. You're on Free limits; your data is safe.`;

  return (
    <div className={`bn-bar bn-${state}`} role={state === "due_soon" ? "status" : "alert"}>
      <UiIcon name={state === "due_soon" ? "clock" : "alert"} className="h-4 w-4 shrink-0" />
      <span className="bn-text">{text}</span>
      <Link href="/dashboard/settings?section=billing" className="bn-action">
        {state === "expired" ? "Renew" : "Pay now"}
      </Link>
      {state === "due_soon" && (
        <button
          type="button"
          className="bn-later"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(DISMISS_KEY, today());
            } catch {
              /* ignore */
            }
          }}
        >
          Later
        </button>
      )}
    </div>
  );
}
