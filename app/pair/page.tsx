"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PhoneScanner from "./PhoneScanner";

/** /pair: type the 6-digit code shown on the laptop (or ?code= from an old link). */
function PairByCode() {
  const code = (useSearchParams().get("code") || "").replace(/\D/g, "").slice(0, 6);
  return <PhoneScanner initialCode={code} />;
}

export default function PairPage() {
  return (
    <Suspense fallback={null}>
      <PairByCode />
    </Suspense>
  );
}
