"use client";

import { useParams } from "next/navigation";
import PhoneScanner from "../PhoneScanner";

/** /pair/<token>: what the QR on the laptop opens. */
export default function PairByTokenPage() {
  const params = useParams();
  const raw = params.token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  return <PhoneScanner key={token} token={token || ""} />;
}
