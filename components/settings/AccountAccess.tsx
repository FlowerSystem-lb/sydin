"use client";

import { useEffect, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import { Button, DialogShell, useToast } from "@/components/ui";
import GoogleMark from "@/components/GoogleMark";
import MicrosoftMark from "@/components/MicrosoftMark";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";

/* Settings > My profile: the sign-in email and linked accounts
   (30 Sep 2026, after Sortly's "Linked Accounts").
 *
 * Change email -- Supabase "Secure email change" is on, so a code goes to the
 * OLD and to the NEW address and both must be entered: a thief who got into
 * a session can't quietly move the account to their own email. On an
 * account with an authenticator app, Supabase also wants that code (AAL2).
 *
 * Linked accounts -- Google / Microsoft can be linked (Supabase "manual
 * linking") or unlinked. The last way to sign in can never be removed.
 * Confirmations are page dialogs, never window.confirm (browsers block it). */

type Provider = "google" | "azure";

const PROVIDER_LABEL: Record<string, string> = { email: "Email & password", google: "Google", azure: "Microsoft" };

function friendly(message: string) {
  const text = message.toLowerCase();
  if (text.includes("manual linking")) return "Linking accounts isn't switched on yet. Ask SydIN support.";
  if (text.includes("already linked to another user") || (text.includes("already") && text.includes("linked")))
    return "That account already belongs to another SydIN account. Sign in with it, delete that account (Settings > My profile), then link it here.";
  if (text.includes("already") && (text.includes("registered") || text.includes("exists")))
    return "That account is already used by another SydIN login.";
  if (text.includes("expired")) return "That code has expired. Start again to get new codes.";
  if (text.includes("invalid") || text.includes("token") || text.includes("otp")) return "A code isn't right. Check both emails and try again.";
  if (text.includes("rate") || text.includes("seconds")) return "Please wait a minute and try again.";
  return message || "Something went wrong. Please try again.";
}

async function passAuthenticator(code: string) {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.find((entry) => entry.status === "verified");
  if (!factor) return "No authenticator app found on this account.";
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  return error ? "That app code didn't work. Enter the current one." : null;
}

export default function AccountAccess({
  email,
  identities,
  canChangeEmail,
  onChanged,
}: {
  email: string;
  identities: UserIdentity[];
  /** false for logins SydIN made for a team (their owner manages them). */
  canChangeEmail: boolean;
  onChanged: () => void;
}) {
  const { showToast } = useToast();

  // ---- change email
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [stage, setStage] = useState<"enter" | "codes">("enter");
  const [oldCode, setOldCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [needsApp, setNeedsApp] = useState(false);
  const [appCode, setAppCode] = useState("");
  const [busy, setBusy] = useState(false);

  // ---- unlink
  const [unlinking, setUnlinking] = useState<UserIdentity | null>(null);

  /* Linking goes out to Google / Microsoft and comes back to this page. When
     Supabase refuses (e.g. that account already belongs to another SydIN
     login), the reason arrives in the URL -- it used to be ignored, so the
     page simply looked like nothing happened (30 Sep 2026). */
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromHash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const description =
      url.searchParams.get("error_description") || fromHash.get("error_description");
    if (!description) return;
    showToast({ tone: "danger", message: friendly(decodeURIComponent(description.replace(/[+]/g, " "))) });
    ["error", "error_code", "error_description"].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [showToast]);

  const resetEmailFlow = () => {
    setChanging(false);
    setNewEmail("");
    setStage("enter");
    setOldCode("");
    setNewCode("");
    setNeedsApp(false);
    setAppCode("");
  };

  const sendCodes = async () => {
    const target = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      showToast({ tone: "danger", message: "Enter a valid email address." });
      return;
    }
    if (target === email.toLowerCase()) {
      showToast({ tone: "danger", message: "That's already your email." });
      return;
    }
    setBusy(true);
    if (needsApp) {
      const problem = await passAuthenticator(appCode);
      if (problem) {
        setBusy(false);
        setAppCode("");
        showToast({ tone: "danger", message: problem });
        return;
      }
    }
    const { error } = await supabase.auth.updateUser(
      { email: target },
      { emailRedirectTo: `${window.location.origin}/dashboard/settings?section=profile` }
    );
    setBusy(false);
    if (error && /aal2|mfa/i.test(error.message)) {
      setNeedsApp(true);
      showToast({ tone: "info", message: "Enter the 6-digit code from your authenticator app, then press Send codes again." });
      return;
    }
    if (error) {
      showToast({ tone: "danger", message: friendly(error.message) });
      return;
    }
    setNewEmail(target);
    setStage("codes");
    showToast({ tone: "success", message: `Codes sent to ${email} and ${target}.` });
  };

  const confirmCodes = async () => {
    if (oldCode.length !== 6 || newCode.length !== 6) return;
    setBusy(true);
    // Either order works; Supabase changes the email once both are accepted.
    const first = await supabase.auth.verifyOtp({ email, token: oldCode, type: "email_change" });
    const second = first.error ? first : await supabase.auth.verifyOtp({ email: newEmail, token: newCode, type: "email_change" });
    setBusy(false);
    if (first.error || second.error) {
      showToast({ tone: "danger", message: friendly((first.error || second.error)?.message || "") });
      return;
    }
    showToast({ tone: "success", message: `Your email is now ${newEmail}. Use it to sign in.` });
    resetEmailFlow();
    onChanged();
  };

  // ---- linked accounts
  const byProvider = (provider: string) => identities.find((identity) => identity.provider === provider) ?? null;

  const link = async (provider: Provider) => {
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard/settings?section=profile`,
        ...(provider === "azure" ? { scopes: "email" } : {}),
      },
    });
    if (error) showToast({ tone: "danger", message: friendly(error.message) });
  };

  const confirmUnlink = async () => {
    if (!unlinking) return;
    setBusy(true);
    const { error } = await supabase.auth.unlinkIdentity(unlinking);
    setBusy(false);
    if (error) {
      showToast({
        tone: "danger",
        message: /aal2|mfa/i.test(error.message)
          ? "For safety, open SydIN admin with your authenticator code first, then unlink again."
          : friendly(error.message),
      });
      return;
    }
    showToast({ tone: "success", message: `${PROVIDER_LABEL[unlinking.provider] ?? "Account"} unlinked.` });
    setUnlinking(null);
    onChanged();
  };

  const onlyOne = identities.length <= 1;
  const identityEmail = (identity: UserIdentity | null) =>
    (identity?.identity_data?.email as string | undefined) || (identity ? email : "");

  return (
    <>
      <div className="st-row">
        <div className="st-row-label" title="The email you sign in with. SydIN sends codes and receipts here.">
          <span>Email</span>
        </div>
        <div className="st-row-control">
          {!changing ? (
            <div className="st-inline">
              <span className="st-strong">{email || "—"}</span>
              {canChangeEmail && (
                <Button variant="secondary" size="sm" onClick={() => setChanging(true)}>
                  Change email
                </Button>
              )}
            </div>
          ) : (
            <div className="st-email-change">
              {stage === "enter" ? (
                <>
                  <p className="st-hint">
                    We&apos;ll send a code to <strong>{email}</strong> and to the new address. Both are needed, so
                    nobody can move your account without access to your current email.
                  </p>
                  <input
                    className="st-input"
                    type="email"
                    placeholder="New email address"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    aria-label="New email address"
                  />
                  {needsApp && (
                    <input
                      className="st-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6-digit code from your authenticator app"
                      value={appCode}
                      onChange={(event) => setAppCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      aria-label="Authenticator app code"
                    />
                  )}
                  <div className="st-inline">
                    <Button size="sm" loading={busy} loadingLabel="Sending…" disabled={!newEmail.trim() || (needsApp && appCode.length !== 6)} onClick={() => void sendCodes()}>
                      Send codes
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={resetEmailFlow}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="st-hint">Enter the code from each email. They work for 10 minutes.</p>
                  <label className="st-email-code">
                    <span>Code sent to {email}</span>
                    <input
                      className="st-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={oldCode}
                      onChange={(event) => setOldCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </label>
                  <label className="st-email-code">
                    <span>Code sent to {newEmail}</span>
                    <input
                      className="st-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={newCode}
                      onChange={(event) => setNewCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </label>
                  <div className="st-inline">
                    <Button size="sm" loading={busy} loadingLabel="Checking…" disabled={oldCode.length !== 6 || newCode.length !== 6} onClick={() => void confirmCodes()}>
                      Confirm new email
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={resetEmailFlow}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="st-row">
        <div className="st-row-label" title="The ways you can sign in to this account.">
          <span>Linked accounts</span>
        </div>
        <div className="st-row-control">
          <ul className="st-linked">
            {(["email", "google", "azure"] as const).map((provider) => {
              const identity = byProvider(provider);
              return (
                <li key={provider}>
                  <span className="st-linked-icon" aria-hidden="true">
                    {provider === "google" ? <GoogleMark /> : provider === "azure" ? <MicrosoftMark /> : <UiIcon name="mail" className="h-4 w-4" />}
                  </span>
                  <span className="st-linked-text">
                    <strong>{PROVIDER_LABEL[provider]}</strong>
                    <small>{identity ? identityEmail(identity) : "Not connected"}</small>
                  </span>
                  {provider === "email" ? (
                    <span className={`st-pill ${identity ? "st-pill-green" : "st-pill-grey"}`}>{identity ? "Connected" : "Not set"}</span>
                  ) : identity ? (
                    <button
                      type="button"
                      className="st-linked-action"
                      disabled={onlyOne}
                      title={onlyOne ? "This is your only way to sign in, so it can't be removed." : undefined}
                      onClick={() => setUnlinking(identity)}
                    >
                      <UiIcon name="close" className="h-3.5 w-3.5" />
                      Unlink
                    </button>
                  ) : (
                    <button type="button" className="st-linked-action st-linked-link" onClick={() => void link(provider)}>
                      <UiIcon name="plus" className="h-3.5 w-3.5" />
                      Link
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <DialogShell
        open={unlinking !== null}
        tone="danger"
        eyebrow="Linked accounts"
        title={`Unlink ${unlinking ? PROVIDER_LABEL[unlinking.provider] ?? "this account" : ""}?`}
        description="You won't be able to sign in with it any more. Your data and your other sign-in methods are not affected."
        onClose={() => setUnlinking(null)}
        closeDisabled={busy}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnlinking(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmUnlink()} loading={busy} loadingLabel="Unlinking…">
              Unlink
            </Button>
          </>
        }
      />
    </>
  );
}
