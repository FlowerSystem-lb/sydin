"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { ROLE_LABELS, type BusinessRole } from "@/app/lib/business";
import { Button, DialogShell, Select, buttonClassName, useToast } from "@/components/ui";
import UiIcon from "@/components/UiIcon";

/* Settings > Team (27 Sep 2026). Owner and admins invite people by email and
   pick a role. Nothing is emailed: when the invited person signs in to SydIN
   with that address, the dashboard offers them the invitation. Every action
   goes through a database function that re-checks the caller's role
   (sql/phase-28-team-access.sql), so this screen only has to be clear. */

type MemberRole = Exclude<BusinessRole, "owner">;

type TeamRow = {
  id: number | null;
  email: string;
  role: BusinessRole;
  status: "invited" | "active";
  is_owner: boolean;
  is_you: boolean;
};

const ROLE_HELP: Record<MemberRole, string> = {
  admin: "Everything except plan and billing, including the team.",
  staff: "Adds and edits stock, orders and invoices. Can't delete or change settings.",
  viewer: "Sees everything, changes nothing.",
};

const SIGN_IN_URL = "https://www.sydin.site/login";

function friendlyError(message: string | undefined) {
  if (!message) return "Something went wrong. Please try again.";
  return message.replace(/^.*?: /, "");
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
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<MemberRole>("staff");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<TeamRow | null>(null);

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

  const inviteMessage = (to: string) =>
    `You're invited to join ${businessName} on SydIN. Sign in at ${SIGN_IN_URL} with ${to} and accept the invitation.`;

  const copyInvite = async (to: string) => {
    try {
      await navigator.clipboard.writeText(inviteMessage(to));
      showToast({ tone: "success", message: "Invitation message copied. Send it on WhatsApp or email." });
    } catch {
      showToast({ tone: "danger", message: "Couldn't copy. Tell them to sign in with " + to + "." });
    }
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;
    setInviting(true);
    setInviteError("");
    const { error } = await supabase.rpc("invite_member", { p_email: address, p_role: newRole });
    setInviting(false);
    if (error) {
      setInviteError(friendlyError(error.message));
      return;
    }
    setEmail("");
    showToast({ tone: "success", message: `${address} is invited as ${ROLE_LABELS[newRole]}.` });
    void copyInvite(address);
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

  const confirmRemove = async () => {
    if (!removing || removing.id === null) return;
    setBusyId(removing.id);
    const { error } = await supabase.rpc("remove_member", { p_member_row: removing.id });
    setBusyId(null);
    if (error) {
      showToast({ tone: "danger", message: friendlyError(error.message) });
      return;
    }
    showToast({ tone: "success", message: `${removing.email} no longer has access.` });
    setRemoving(null);
    void load();
  };

  return (
    <>
      <div className="st-row">
        <div className="st-row-label">
          <label htmlFor="team-invite-email">Invite someone</label>
          <p>They sign in to SydIN with this email and accept. No password is shared.</p>
        </div>
        <form className="st-row-control" onSubmit={invite}>
          <div className="st-team-invite">
            <input
              id="team-invite-email"
              type="email"
              className="st-input"
              placeholder="name@company.com"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={atLimit}
            />
            <div className="st-team-role">
              <Select
                ariaLabel="Role"
                value={newRole}
                options={roleOptions}
                onChange={(value) => setNewRole(value as MemberRole)}
                disabled={atLimit}
              />
            </div>
            <Button type="submit" loading={inviting} loadingLabel="Inviting…" disabled={atLimit || !email.trim()}>
              Invite
            </Button>
          </div>
          {inviteError && (
            <p role="alert" className="st-team-error">
              {inviteError}
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
                  {row.status === "invited" ? "Invited · hasn't signed in yet" : row.is_owner ? "Owner" : "Active"}
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
                {!row.is_owner && row.status === "invited" && (
                  <button
                    type="button"
                    className={buttonClassName({ variant: "ghost", size: "sm" })}
                    onClick={() => void copyInvite(row.email)}
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
        open={Boolean(removing)}
        tone="danger"
        eyebrow="Team"
        title="Remove this person?"
        description={
          removing
            ? `${removing.email} will lose access to ${businessName} straight away. Nothing they added is deleted.`
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
