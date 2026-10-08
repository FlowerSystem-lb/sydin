"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * The old signed-in phone page. Since phase 38 the phone links without a
 * login at /pair, so old links and bookmarks land there with their code.
 */
function RedirectToPair() {
  const router = useRouter();
  const code = useSearchParams().get("code") || "";

  useEffect(() => {
    router.replace(code ? `/pair?code=${encodeURIComponent(code)}` : "/pair");
  }, [code, router]);

  return null;
}

export default function PhoneScannerPage() {
  return (
    <Suspense fallback={null}>
      <RedirectToPair />
    </Suspense>
  );
}
