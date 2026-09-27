"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { ROLE_LABELS, clearBusinessContext } from "@/app/lib/business";
import { Button, useToast } from "@/components/ui";
import { useBusiness } from "@/components/dashboard/BusinessContext";

/* Shown when someone invited this person's email to their business
   (Settings > Team). Invitations are not emailed; this banner is how the
   invited person finds out, the next time they sign in. */
export default function TeamInviteBanner() {
  const business = useBusiness();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const invite = business?.invites.find((item) => !dismissed.includes(item.id));
  if (!invite) return null;

  const accept = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("accept_invite", { p_member_row: invite.id });
    if (error) {
      setBusy(false);
      showToast({ tone: "danger", message: error.message.replace(/^.*?: /, "") });
      return;
    }
    clearBusinessContext();
    // Everything on screen was scoped to your own account; start again inside
    // the business you just joined.
    window.location.assign("/dashboard");
  };

  const decline = async () => {
    setBusy(true);
    await supabase.rpc("decline_invite", { p_member_row: invite.id });
    setBusy(false);
    setDismissed((current) => [...current, invite.id]);
  };

  return (
    <div className="team-invite-banner" role="region" aria-label="Team invitation">
      <p>
        <strong>{invite.businessName}</strong> invited you to join their team as{" "}
        <strong>{ROLE_LABELS[invite.role]}</strong>.
        <span>While you are a member you work in their stock, not your own. You can leave any time.</span>
      </p>
      <div className="team-invite-actions">
        <Button variant="ghost" size="sm" onClick={() => void decline()} disabled={busy}>
          Decline
        </Button>
        <Button size="sm" onClick={() => void accept()} loading={busy} loadingLabel="Joining…">
          Join
        </Button>
      </div>
    </div>
  );
}
