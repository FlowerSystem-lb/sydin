import { useEffect, useState } from "react";

/**
 * True while the viewport matches a CSS media query.
 *
 * Why this exists: the Inventory table view rendered a phone card list AND
 * the desktop table from the same items and let CSS hide one. At 500
 * products that is 1,000 rows of work for every "Show more" -- measured at
 * up to 709ms per click. Rendering only the layout that is actually
 * visible halves it before anything else is touched.
 *
 * The initial value is read synchronously when a window exists, so the
 * first client render already picks the right branch. The dashboard is
 * client-rendered behind the session gate, so there is no server HTML to
 * disagree with.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}
