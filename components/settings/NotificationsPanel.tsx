"use client";

import { useState } from "react";
import { Button, useToast } from "@/components/ui";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";

/* Settings > Notifications (30 Sep 2026, Sayed: "a full notification system
   in its own section"). One table: every event SydIN tells you about, and
   where -- the bell in the app and/or an email to the owner.
 *
 *   Instant emails   -- the moment an item runs low or out (app/api/notify/stock)
 *   Daily summary    -- 9:00, items low, only when the list changed
 *   Weekly summary   -- Mondays 9:00
 *   Billing/security -- always on: payment due, receipts, password changes
 *
 * Choices are saved on the owner's login (user_metadata), read by the server
 * jobs. Saved on every toggle, no Save button. */

type Key = "notify_item_low" | "notify_item_out" | "notify_low_stock" | "notify_weekly";

interface Row {
  key?: Key;
  title: string;
  detail: string;
  bell: "always" | "none";
  email: "choice" | "always";
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Stock",
    rows: [
      { key: "notify_item_low", title: "An item runs low", detail: "The moment an item reaches its low-stock level.", bell: "always", email: "choice" },
      { key: "notify_item_out", title: "An item runs out", detail: "The moment an item reaches zero.", bell: "always", email: "choice" },
      { key: "notify_low_stock", title: "Daily low-stock summary", detail: "Every day at 9:00, the full list, only when it changed.", bell: "none", email: "choice" },
    ],
  },
  {
    title: "Business",
    rows: [
      { key: "notify_weekly", title: "Weekly summary", detail: "Mondays at 9:00: sales, payments, what customers owe, stock to reorder.", bell: "none", email: "choice" },
    ],
  },
  {
    title: "Plan and security",
    rows: [
      { title: "Plan renewals and receipts", detail: "7 days before renewal, payment due, plan ended, and a receipt for every payment.", bell: "always", email: "always" },
      { title: "Security alerts", detail: "Password or email changed, sign-in methods linked or removed.", bell: "none", email: "always" },
    ],
  },
];

export default function NotificationsPanel({
  email,
  initial,
}: {
  email: string;
  initial: Record<Key, boolean>;
}) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<Key, boolean>>(initial);
  const [testing, setTesting] = useState(false);

  const toggle = async (key: Key, value: boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
    const { error } = await supabase.auth.updateUser({ data: { [key]: value } });
    if (error) {
      setValues((current) => ({ ...current, [key]: !value }));
      showToast({ tone: "danger", message: "Couldn't save that. Please try again." });
      return;
    }
    showToast({ tone: "success", message: value ? "On. You'll get these emails." : "Off. No more of these emails." });
  };

  const sendTest = async () => {
    setTesting(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/notify/test", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    }).catch(() => null);
    setTesting(false);
    showToast(
      response?.ok
        ? { tone: "success", message: `Test email sent to ${email}. Check Spam the first time.` }
        : { tone: "danger", message: "Couldn't send the test. Please try again in a minute." }
    );
  };

  return (
    <div className="nt-panel">
      <div className="nt-intro">
        <span className="nt-intro-icon" aria-hidden="true">
          <UiIcon name="bell" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="nt-intro-title">Choose what SydIN tells you, and where</p>
          <p className="nt-intro-text">
            Emails go to <strong>{email || "your email"}</strong>. Alerts inside SydIN (the bell and the top bar) show for everyone on your team.
          </p>
        </div>
        <Button variant="secondary" size="sm" loading={testing} loadingLabel="Sending…" onClick={() => void sendTest()}>
          Send a test email
        </Button>
      </div>

      <div className="nt-table" role="table" aria-label="Notifications">
        <div className="nt-head" role="row">
          <span role="columnheader">Event</span>
          <span role="columnheader">In app</span>
          <span role="columnheader">Email</span>
        </div>
        {GROUPS.map((group) => (
          <div key={group.title} role="rowgroup">
            <p className="nt-group">{group.title}</p>
            {group.rows.map((row) => (
              <div key={row.title} className="nt-row" role="row">
                <span className="nt-event" role="cell">
                  <strong>{row.title}</strong>
                  <small>{row.detail}</small>
                </span>
                <span className="nt-cell" role="cell">
                  {row.bell === "always" ? (
                    <span className="nt-on" title="Always shown inside SydIN">
                      <UiIcon name="check" className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="nt-none" aria-label="Not shown in the app">—</span>
                  )}
                </span>
                <span className="nt-cell" role="cell">
                  {row.email === "always" ? (
                    <span className="nt-locked" title="Always sent: these protect your account and plan">
                      <UiIcon name="lock" className="h-3 w-3" />
                      Always
                    </span>
                  ) : row.key ? (
                    <label className="st-switch nt-switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`Email: ${row.title}`}
                        checked={values[row.key]}
                        onChange={(event) => void toggle(row.key as Key, event.target.checked)}
                      />
                      <span aria-hidden="true" />
                    </label>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
