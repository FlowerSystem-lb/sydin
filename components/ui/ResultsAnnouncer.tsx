"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Says how many results a list is showing, to screen readers only.
 *
 * Filtering a table changed the rows and told a screen-reader user nothing:
 * the count sat in the page as ordinary text, so unless you happened to move
 * the cursor back over it, you typed into a search box and received silence.
 * Only 5 of 31 dashboard pages had any live region at all.
 *
 * Two details that decide whether this works or is merely present:
 *
 * - **The region is mounted from the start and left empty.** A live region
 *   created at the same moment as its message is routinely missed; the text
 *   has to change inside a region that was already being watched.
 * - **It waits.** Announcing on every keystroke means "43 results, 12
 *   results, 4 results, 1 result" over a four-letter word. It settles first,
 *   then speaks once.
 */
export default function ResultsAnnouncer({
  count,
  noun = "result",
  pluralNoun,
  delay = 600,
}: {
  count: number;
  /** "supplier" -> "1 supplier" / "4 suppliers". */
  noun?: string;
  /** Only when adding "s" is wrong: "entry" -> "entries". */
  pluralNoun?: string;
  delay?: number;
}) {
  const [announced, setAnnounced] = useState("");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const plural = pluralNoun ?? `${noun}s`;
      setAnnounced(
        count === 0
          ? `No ${plural} found`
          : `${count} ${count === 1 ? noun : plural}`
      );
    }, delay);

    return () => window.clearTimeout(timer.current);
  }, [count, noun, pluralNoun, delay]);

  return (
    <p className="sr-only" role="status" aria-live="polite">
      {announced}
    </p>
  );
}
