"use client";

import { createContext, useContext } from "react";
import type { BusinessContext } from "@/app/lib/business";

/* The signed-in person's business and role, loaded once by the dashboard
   layout. Pages read it to hide what a role cannot do; the database is what
   actually refuses it (sql/phase-28-team-access.sql). */
const BusinessReactContext = createContext<BusinessContext | null>(null);

export const BusinessProvider = BusinessReactContext.Provider;

export function useBusiness() {
  return useContext(BusinessReactContext);
}
