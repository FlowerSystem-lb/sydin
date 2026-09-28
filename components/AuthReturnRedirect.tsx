"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

/* Safety net for Google / Microsoft sign-in (28 Sep 2026).
 *
 * Sign-in asks Supabase to return to /dashboard. When that address is not on
 * Supabase's allowed redirect list (it happened after the move to
 * www.sydin.site), Supabase falls back to the Site URL -- the landing page --
 * with the session in the address (#access_token=... or ?code=...), which the
 * Supabase client then consumes, leaving a bare "#". The person is signed in
 * but looking at the marketing page. This sends them on to the dashboard.
 *
 * It acts only on an arrival that carries sign-in data, so a signed-in person
 * can still open the landing page on purpose. The real fix is the allowed
 * redirect list in Supabase > Authentication > URL Configuration. */
// Read when this module loads, before hydration: the Supabase client strips
// the tokens from the address once it has stored the session, and an effect
// can run after that.
const ARRIVED_FROM_SIGN_IN =
  typeof window !== "undefined" &&
  (/access_token|refresh_token|provider_token/.test(window.location.hash) ||
    /[?&]code=/.test(window.location.search));

export default function AuthReturnRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!ARRIVED_FROM_SIGN_IN) return;

    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      router.replace("/dashboard");
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) go();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return null;
}
