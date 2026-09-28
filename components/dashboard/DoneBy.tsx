"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useBusiness } from "@/components/dashboard/BusinessContext";

/* "by Ahmed" under a change (28 Sep 2026, team access).
 *
 * actor_id is recorded by the database on history, movements, orders,
 * receipts, payments and pick lists (sql/phase-28, phase-29). Names come from
 * business_people(), which only returns the people of the viewer's own
 * business. Nothing shows for a business of one -- "by You" on every line
 * would be noise -- or for rows older than team access (actor_id null). */

type Person = { user_id: string; display_name: string };

let peoplePromise: Promise<Map<string, string>> | null = null;
let peopleFor: string | null = null;

function loadPeople(businessId: string) {
  if (!peoplePromise || peopleFor !== businessId) {
    peopleFor = businessId;
    peoplePromise = Promise.resolve(supabase.rpc("business_people")).then(({ data, error }) => {
      // Before phase-29 is applied the function doesn't exist: show nothing.
      if (error || !data) return new Map<string, string>();
      return new Map((data as Person[]).map((person) => [person.user_id, person.display_name]));
    });
  }
  return peoplePromise;
}

export function useBusinessPeople() {
  const business = useBusiness();
  const [people, setPeople] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    if (!business?.businessId) return;
    let active = true;
    void loadPeople(business.businessId).then((map) => {
      if (active) setPeople(map);
    });
    return () => {
      active = false;
    };
  }, [business?.businessId]);

  return people;
}

/** Plain text name for an actor, or null when it shouldn't be shown. */
export function useActorName() {
  const business = useBusiness();
  const people = useBusinessPeople();
  return (actorId: string | null | undefined) => {
    if (!actorId || !people || people.size < 2) return null;
    if (actorId === business?.userId) return "You";
    return people.get(actorId) ?? "A former team member";
  };
}

export default function DoneBy({
  actorId,
  prefix = "by",
  className = "done-by",
}: {
  actorId: string | null | undefined;
  prefix?: string;
  className?: string;
}) {
  const nameOf = useActorName();
  const name = nameOf(actorId);
  if (!name) return null;
  return (
    <span className={className}>
      {prefix} {name}
    </span>
  );
}
