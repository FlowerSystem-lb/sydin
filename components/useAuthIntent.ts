"use client";

import { useSyncExternalStore } from "react";
import { getAuthIntent } from "@/app/lib/authNavigation";

const subscribe = () => () => undefined;
const getSnapshot = () => window.location.search;
const getServerSnapshot = () => "";

export default function useAuthIntent() {
  const search = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return getAuthIntent(search);
}
