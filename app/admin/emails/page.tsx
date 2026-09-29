"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { adminFetch } from "@/app/lib/adminClient";

/* Admin > Emails (phase 34): whether automatic billing emails are connected,
   every reminder/receipt sent, a test, and "run the daily check now". */

interface SentRow {
  id: number;
  user_id: string;
  kind: string;
  period_end: string | null;
  email: string | null;
  sent_at: string;
  business: string | null;
}

interface RunResult {
  checked: number;
  sent: { email: string; kind: string }[];
  skipped: number;
  failed: { email: string; kind: string; error: string }[];
}

const KIND_LABEL: Record<string, string> = {
  renew_7d: "Renews in 7 days",
  grace_start: "Ended · 3 days to pay",
  ended: "Moved to Free",
  receipt: "Payment receipt",
  test: "Test",
};

export default function AdminEmailsPage() {
  const [configured, setConfigured] = useState<{ email: boolean; schedule: boolean } | null>(null);
  const [rows, setRows] = useState<SentRow[] | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const load = useCallback(() => {
    adminFetch<{ configured: { email: boolean; schedule: boolean }; sent: SentRow[] }>("/api/admin/emails")
      .then((answer) => {
        setConfigured(answer.configured);
        setRows(answer.sent);
      })
      .catch((failure: Error) => setError(failure.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: "test" | "run") => {
    setBusy(true);
    setError("");
    setFlash("");
    try {
      const answer = await adminFetch<{ message?: string; result?: RunResult }>("/api/admin/emails", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (answer.result) {
        setLastRun(answer.result);
        setFlash(`Checked ${answer.result.checked} paid account(s): ${answer.result.sent.length} email(s) sent.`);
      } else if (answer.message) {
        setFlash(answer.message);
      }
      load();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ready = configured?.email && configured?.schedule;

  return (
    <AdminShell title="Emails" subtitle="Automatic renewal reminders, payment-due notices and receipts.">
      {flash && <p className="ad-flash" role="status">{flash}</p>}
      {error && <p className="ad-error" role="alert">{error}</p>}

      <div className="ad-grid">
        <section className="ad-card">
          <h2>Status</h2>
          <dl className="ad-facts">
            <div>
              <dt>Sending (Resend)</dt>
              <dd>
                {configured === null ? "…" : configured.email ? (
                  <span className="ad-state ad-state-paid">Connected</span>
                ) : (
                  <span className="ad-state ad-state-ended">Missing RESEND_API_KEY</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Daily check (9:00)</dt>
              <dd>
                {configured === null ? "…" : configured.schedule ? (
                  <span className="ad-state ad-state-paid">On</span>
                ) : (
                  <span className="ad-state ad-state-ended">Missing CRON_SECRET</span>
                )}
              </dd>
            </div>
          </dl>
          <p className="ad-muted">
            Every day at 9:00 (Beirut), SydIN emails paying businesses 7 days before their plan ends, on the end day
            (&ldquo;3 days to pay&rdquo;), and when they move to Free. Each email goes once per period. A receipt goes out
            whenever you record a payment. Replies go to support@sydin.site.
          </p>
          <div className="ad-actions">
            <button type="button" className="ad-btn" disabled={busy || !configured?.email} onClick={() => void act("test")}>
              Send me a test email
            </button>
            <button type="button" className="ad-btn ad-btn-primary" disabled={busy || !ready} onClick={() => void act("run")}>
              {busy ? "Working…" : "Run the daily check now"}
            </button>
          </div>
        </section>

        <section className="ad-card">
          <h2>Last manual run</h2>
          {!lastRun ? (
            <p className="ad-muted">Press &ldquo;Run the daily check now&rdquo; to see who gets an email today.</p>
          ) : (
            <ul className="ad-list">
              <li>Paid accounts checked: {lastRun.checked}</li>
              <li>Emails sent: {lastRun.sent.length}</li>
              {lastRun.sent.map((entry) => (
                <li key={`${entry.email}-${entry.kind}`}>
                  {KIND_LABEL[entry.kind] ?? entry.kind} → {entry.email}
                </li>
              ))}
              {lastRun.failed.map((entry) => (
                <li key={`f-${entry.email}-${entry.kind}`} className="ad-error-inline">
                  Not sent to {entry.email}: {entry.error}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ad-card">
        <h2>Sent</h2>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Email</th>
                <th>To</th>
                <th>Plan end</th>
              </tr>
            </thead>
            <tbody>
              {!rows && !error && (
                <tr>
                  <td colSpan={4} className="ad-empty">Loading…</td>
                </tr>
              )}
              {rows && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="ad-empty">Nothing sent yet.</td>
                </tr>
              )}
              {(rows ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.sent_at).toLocaleString()}</td>
                  <td>{KIND_LABEL[row.kind] ?? row.kind}</td>
                  <td>
                    <Link href={`/admin/customers/${row.user_id}`} className="ad-name">
                      {row.business || "Account"}
                    </Link>
                    <span className="ad-sub">{row.email}</span>
                  </td>
                  <td>{row.period_end ? new Date(row.period_end).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
