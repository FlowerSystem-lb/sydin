"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { ROLE_LABELS, type BusinessRole } from "@/app/lib/business";
import { Button, DialogShell, Select, buttonClassName, useToast } from "@/components/ui";
import UiIcon from "@/components/UiIcon";

/* Settings > Team.
 *
 * Two ways in (28 Sep 2026):
 *  - Create a login (default): type a name and a role; SydIN makes
 *    name.role@business.sydin.site and a password and shows them once. For
 *    workers without an email they use. Server routes in app/api/team/.
 *  - Invite by email: for people who want their own address. Nothing is
 *    emailed; they see a "you're invited" bar when they sign in.
 * Every action is re-checked by the database (sql/phase-28-team-access.sql),
 * so this screen only has to be clear. */

type MemberRole = Exclude<BusinessRole, "owner">;
type AddMode = "create" | "invite";

type TeamRow = {
  id: number | null;
  email: string;
  role: BusinessRole;
  status: "invited" | "active";
  is_owner: boolean;
  is_you: boolean;
};

/* password is absent when "Login details" is opened for an existing login:
   SydIN never keeps a readable copy, so the owner makes a new one instead. */
type Credentials = {
  memberRow?: number | null;
  email: string;
  role: MemberRole;
  password?: string;
  name?: string;
  reset?: boolean;
};

const ROLE_HELP: Record<MemberRole, string> = {
  admin: "Everything except plan and billing, including the team.",
  staff: "Adds and edits stock, orders and invoices. Can't delete or change settings.",
  viewer: "Sees everything, changes nothing.",
};

const SIGN_IN_URL = "https://www.sydin.site/login";
const SIGN_UP_URL = "https://www.sydin.site/signup";

// Plain words for the message the owner sends -- the person reading it has
// never seen SydIN.
const ROLE_DETAIL: Record<MemberRole, string> = {
  admin:
    "You can do everything: items and stock, orders, invoices, customers and suppliers, delete records, change the business settings and manage the team. Only the plan and billing stay with the owner.",
  staff:
    "You can add and edit items, record stock in and out, scan barcodes, receive deliveries, and make invoices and purchase orders. You can't delete anything or change the business settings.",
  viewer:
    "You can see everything (stock, orders, invoices and reports) but you can't change anything.",
};

function isManaged(email: string) {
  return /@[a-z0-9]+\.sydin\.site$/.test(email);
}

function friendlyError(message: string | undefined) {
  if (!message) return "Something went wrong. Please try again.";
  return message.replace(/^.*?: /, "");
}

async function teamApi<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`/api/team/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || "Something went wrong. Please try again.");
  return json as T;
}

export default function TeamPanel({
  myRole,
  seatLimit,
  businessName,
  upgradeHref,
}: {
  myRole: BusinessRole;
  seatLimit: number;
  businessName: string;
  upgradeHref: string;
}) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<TeamRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<AddMode>("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<MemberRole>("staff");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<TeamRow | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const isOwner = myRole === "owner";

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_team");
    if (error) {
      setLoadError(friendlyError(error.message));
      return;
    }
    setLoadError("");
    setRows((data ?? []) as TeamRow[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount, state writes happen post-await
    void load();
  }, [load]);

  const members = (rows ?? []).filter((row) => !row.is_owner);
  const seatsUsed = members.length;
  const atLimit = seatsUsed >= seatLimit;

  const roleOptions = (["admin", "staff", "viewer"] as MemberRole[])
    .filter((role) => role !== "admin" || isOwner)
    .map((role) => ({ value: role, label: ROLE_LABELS[role], description: ROLE_HELP[role] }));

  const copyText = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ tone: "success", message: done });
    } catch {
      showToast({ tone: "danger", message: "Couldn't copy. Select the text and copy it by hand." });
    }
  };

  const loginMessage = (login: Credentials) =>
    [
      `Hi${login.name ? ` ${login.name}` : ""}! Here is your SydIN login for ${businessName}.`,
      "",
      `Your role: ${ROLE_LABELS[login.role]}`,
      ROLE_DETAIL[login.role],
      "",
      "How to sign in:",
      `1. Open ${SIGN_IN_URL}`,
      `2. Email: ${login.email}`,
      `3. Password: ${login.password ?? "(the password you were given)"}`,
      `4. Press Sign in. You go straight to ${businessName}.`,
      "",
      "Forgot your password? Ask the owner for a new one (Settings > Team).",
    ].join("\n");

  const inviteMessage = (to: string, role: MemberRole) =>
    [
      `Hi! ${businessName} has invited you to their team on SydIN.`,
      "",
      `Your role: ${ROLE_LABELS[role]}`,
      ROLE_DETAIL[role],
      "",
      "How to join:",
      `1. Open ${SIGN_UP_URL}`,
      `2. Create your account with this exact email: ${to}`,
      "   (A Gmail address? You can press Continue with Google instead.)",
      `   Already have a SydIN account with this email? Sign in at ${SIGN_IN_URL}`,
      `3. After you sign in, a blue bar at the top says "${businessName} invited you". Press Join.`,
      `4. Done. You now see ${businessName}'s stock.`,
    ].join("\n");

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddError("");

    if (mode === "create") {
      if (!name.trim()) return;
      setAdding(true);
      try {
        const login = await teamApi<{ email: string; password: string; name: string }>("create-login", {
          name: name.trim(),
          role: newRole,
        });
        setName("");
        setCredentials({ ...login, role: newRole });
        void load();
      } catch (error) {
        setAddError(error instanceof Error ? error.message : "Could not create the login.");
      } finally {
        setAdding(false);
      }
      return;
    }

    const address = email.trim().toLowerCase();
    if (!address) return;
    setAdding(true);
    const { error } = await supabase.rpc("invite_member", { p_email: address, p_role: newRole });
    setAdding(false);
    if (error) {
      setAddError(friendlyError(error.message));
      return;
    }
    setEmail("");
    showToast({ tone: "success", message: `${address} is invited as ${ROLE_LABELS[newRole]}.` });
    void copyText(
      inviteMessage(address, newRole),
      "Invitation with the steps copied. Send it on WhatsApp or email."
    );
    void load();
  };

  const changeRole = async (row: TeamRow, role: string) => {
    if (row.id === null || role === row.role) return;
    setBusyId(row.id);
    const { error } = await supabase.rpc("change_member_role", { p_member_row: row.id, p_role: role });
    setBusyId(null);
    if (error) {
      showToast({ tone: "danger", message: friendlyError(error.message) });
      return;
    }
    showToast({ tone: "success", message: `${row.email} is now ${ROLE_LABELS[role as MemberRole]}.` });
    void load();
  };

  const resetPassword = async (memberRow: number | null | undefined, role: MemberRole) => {
    if (memberRow == null) return;
    setBusyId(memberRow);
    try {
      const login = await teamApi<{ email: string; password: string }>("reset-password", { memberRow });
      setCredentials({ ...login, memberRow, role, reset: true });
    } catch (error) {
      showToast({ tone: "danger", message: error instanceof Error ? error.message : "Could not reset." });
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing || removing.id === null) return;
    setBusyId(removing.id);
    try {
      await teamApi("remove", { memberRow: removing.id });
      showToast({ tone: "success", message: `${removing.email} no longer has access.` });
      setRemoving(null);
      void load();
    } catch (error) {
      showToast({ tone: "danger", message: error instanceof Error ? error.message : "Could not remove." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="st-row">
        <div className="st-row-label">
          <span>Add someone</span>
          <p>
            {mode === "create"
              ? "SydIN makes a login for them. You get the email and password to send them."
              : "For people with their own email. New to SydIN? They sign up with this exact email first; the message you copy explains the steps."}
          </p>
        </div>
        <form className="st-row-control" onSubmit={add}>
          <div className="st-team-mode" role="tablist" aria-label="How to add them">
            {(
              [
                ["create", "Create a login"],
                ["invite", "Invite by email"],
              ] as [AddMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                className={mode === value ? "st-team-mode-active" : undefined}
                onClick={() => {
                  setMode(value);
                  setAddError("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="st-team-invite">
            {mode === "create" ? (
              <input
                aria-label="Name"
                type="text"
                className="st-input"
                placeholder="Their name, e.g. Ahmed"
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={atLimit}
                maxLength={60}
              />
            ) : (
              <input
                aria-label="Email"
                type="email"
                className="st-input"
                placeholder="name@company.com"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={atLimit}
              />
            )}
            <div className="st-team-role">
              <Select
                ariaLabel="Role"
                value={newRole}
                options={roleOptions}
                onChange={(value) => setNewRole(value as MemberRole)}
                disabled={atLimit}
              />
            </div>
            <Button
              type="submit"
              loading={adding}
              loadingLabel={mode === "create" ? "Creating…" : "Inviting…"}
              disabled={atLimit || !(mode === "create" ? name.trim() : email.trim())}
            >
              {mode === "create" ? "Create login" : "Invite"}
            </Button>
          </div>
          {addError && (
            <p role="alert" className="st-team-error">
              {addError}
            </p>
          )}
          <p className="st-hint">
            {seatsUsed} of {seatLimit} team {seatLimit === 1 ? "seat" : "seats"} used.
            {atLimit && (
              <>
                {" "}
                <Link href={upgradeHref} className="st-link">
                  Upgrade for more
                </Link>
              </>
            )}
          </p>
        </form>
      </div>

      <div className="st-team-list">
        {loadError && (
          <p role="alert" className="st-team-error">
            {loadError}
          </p>
        )}
        {!rows && !loadError && <p className="st-hint">Loading the team…</p>}
        {rows?.map((row) => {
          const locked = row.is_owner || row.is_you || (row.role === "admin" && !isOwner);
          const managed = !row.is_owner && isManaged(row.email);
          return (
            <div key={row.id ?? "owner"} className="st-team-row">
              <span className="st-team-avatar" aria-hidden="true">
                {row.email.charAt(0).toUpperCase()}
              </span>
              <div className="st-team-who">
                <p className="st-team-email">
                  {row.email}
                  {row.is_you && <span className="st-team-you"> (you)</span>}
                </p>
                <p className="st-hint">
                  {row.is_owner
                    ? "Owner"
                    : managed
                      ? "SydIN login · signs in with the password you gave them"
                      : row.status === "invited"
                        ? "Invited · hasn't signed in yet"
                        : "Active · own email"}
                </p>
              </div>
              <div className="st-team-actions">
                {locked ? (
                  <span className={`st-pill ${row.is_owner ? "st-pill-green" : "st-pill-grey"}`}>
                    {ROLE_LABELS[row.role]}
                  </span>
                ) : (
                  <div className="st-team-role">
                    <Select
                      ariaLabel={`Role for ${row.email}`}
                      value={row.role}
                      options={roleOptions}
                      onChange={(value) => void changeRole(row, value)}
                      loading={busyId === row.id}
                    />
                  </div>
                )}
                {managed && !locked && (
                  <button
                    type="button"
                    className={buttonClassName({ variant: "ghost", size: "sm" })}
                    onClick={() =>
                      setCredentials({ memberRow: row.id, email: row.email, role: row.role as MemberRole })
                    }
                  >
                    Login details
                  </button>
                )}
                {!managed && !row.is_owner && row.status === "invited" && (
                  <button
                    type="button"
                    className={buttonClassName({ variant: "ghost", size: "sm" })}
                    onClick={() =>
                      void copyText(
                        inviteMessage(row.email, row.role as MemberRole),
                        "Invitation with the steps copied."
                      )
                    }
                    aria-label={`Copy invitation for ${row.email}`}
                  >
                    <UiIcon name="copy" className="h-4 w-4" />
                  </button>
                )}
                {!locked && (
                  <button
                    type="button"
                    className={buttonClassName({ variant: "ghost", size: "sm" })}
                    onClick={() => setRemoving(row)}
                    aria-label={`Remove ${row.email}`}
                  >
                    <UiIcon name="trash" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DialogShell
        open={Boolean(credentials)}
        eyebrow="Team"
        title={
          credentials?.password
            ? credentials.reset
              ? "New password ready"
              : `Login ready${credentials.name ? ` for ${credentials.name}` : ""}`
            : "Login details"
        }
        description={
          credentials?.password
            ? "Copy the login and send it to them now. The password is shown only this once, but you can always make a new one here."
            : "For safety SydIN never keeps a readable copy of a password. Make a new one to send them; the old one stops working."
        }
        onClose={() => setCredentials(null)}
        footer={
          credentials?.password ? (
            <>
              <Button variant="secondary" onClick={() => setCredentials(null)}>
                Done
              </Button>
              <Button
                onClick={() =>
                  void copyText(loginMessage(credentials), "Login and steps copied. Send it on WhatsApp.")
                }
              >
                Copy login and steps
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setCredentials(null)}>
                Close
              </Button>
              <Button
                onClick={() => credentials && void resetPassword(credentials.memberRow, credentials.role)}
                loading={busyId !== null}
                loadingLabel="Making…"
              >
                Make a new password
              </Button>
            </>
          )
        }
      >
        {credentials && (
          <dl className="st-login-card">
            <div>
              <dt>Email</dt>
              <dd>{credentials.email}</dd>
            </div>
            <div>
              <dt>Password</dt>
              {credentials.password ? (
                <dd className="st-login-password">{credentials.password}</dd>
              ) : (
                <dd className="st-login-hidden">Hidden for safety</dd>
              )}
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                {ROLE_LABELS[credentials.role]}
                <span className="st-login-role-help">{ROLE_DETAIL[credentials.role]}</span>
              </dd>
            </div>
            <div>
              <dt>Sign in at</dt>
              <dd>www.sydin.site/login</dd>
            </div>
          </dl>
        )}
      </DialogShell>

      <DialogShell
        open={Boolean(removing)}
        tone="danger"
        eyebrow="Team"
        title="Remove this person?"
        description={
          removing
            ? isManaged(removing.email)
              ? `The login ${removing.email} is deleted and stops working straight away. Nothing they added is deleted.`
              : `${removing.email} will lose access to ${businessName} straight away. Nothing they added is deleted.`
            : undefined
        }
        onClose={() => setRemoving(null)}
        closeDisabled={busyId !== null}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)} disabled={busyId !== null}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmRemove()} loading={busyId !== null} loadingLabel="Removing…">
              Remove
            </Button>
          </>
        }
      />
    </>
  );
}
