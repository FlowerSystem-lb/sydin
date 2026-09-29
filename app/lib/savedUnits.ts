"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { getBusinessId } from "@/app/lib/business";
import { BUSINESS_SETTINGS_SAVED_EVENT, type BusinessSettings } from "@/app/lib/businessSettings";
import {
  INVENTORY_UNIT_LABELS,
  INVENTORY_UNIT_TYPES,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";

/* Phase 31: the business's own units (Settings > Lists) in every unit picker.
 *
 * A saved unit is stored on an item exactly like a typed custom unit
 * (unit_type "custom" + custom_unit_label), so items, imports, exports and
 * the database rule on unit_type are unchanged. The picker just offers the
 * saved labels by name instead of making people retype "Carton" each time. */

let cache: string[] | null = null;
let pending: Promise<string[]> | null = null;

async function loadSavedUnits(): Promise<string[]> {
  if (cache) return cache;
  if (!pending) {
    pending = (async () => {
      const businessId = await getBusinessId();
      if (!businessId) return [];
      const { data, error } = await supabase
        .from("business_settings")
        .select("custom_units")
        .eq("user_id", businessId)
        .maybeSingle();
      // Before sql/phase-31 the column is missing: no saved units, no error.
      const units = !error && Array.isArray(data?.custom_units) ? (data.custom_units as string[]) : [];
      cache = units;
      return units;
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function useSavedUnits() {
  const [units, setUnits] = useState<string[]>(() => cache ?? []);
  useEffect(() => {
    let live = true;
    void loadSavedUnits().then((loaded) => {
      if (live) setUnits(loaded);
    });
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<BusinessSettings>).detail;
      if (detail && Array.isArray(detail.custom_units)) {
        cache = detail.custom_units;
        setUnits(detail.custom_units);
      }
    };
    window.addEventListener(BUSINESS_SETTINGS_SAVED_EVENT, onSaved);
    return () => {
      live = false;
      window.removeEventListener(BUSINESS_SETTINGS_SAVED_EVENT, onSaved);
    };
  }, []);
  return units;
}

const SAVED_PREFIX = "saved:";

/** Built-in units, then the business's own, then "Other…" to type one. */
export function unitPickerOptions(saved: string[]) {
  return [
    ...INVENTORY_UNIT_TYPES.filter((unit) => unit !== "custom").map((unit) => ({
      value: unit as string,
      label: INVENTORY_UNIT_LABELS[unit],
    })),
    ...saved.map((label) => ({ value: `${SAVED_PREFIX}${label}`, label })),
    { value: "custom", label: "Other (type it)" },
  ];
}

/** What the picker shows for an item's unit. */
export function unitPickerValue(unitType: InventoryUnitType, customLabel: string, saved: string[]) {
  if (unitType === "custom") {
    const match = saved.find((label) => label.toLowerCase() === customLabel.trim().toLowerCase());
    if (match) return `${SAVED_PREFIX}${match}`;
  }
  return unitType;
}

/** Turn a picked option back into the item's unit_type + custom label.
 *  `customLabel` is null when the label should stay as it is. */
export function unitFromPicker(value: string): { unitType: InventoryUnitType; customLabel: string | null } {
  if (value.startsWith(SAVED_PREFIX)) {
    return { unitType: "custom", customLabel: value.slice(SAVED_PREFIX.length) };
  }
  if (value === "custom") return { unitType: "custom", customLabel: "" };
  return { unitType: value as InventoryUnitType, customLabel: null };
}
