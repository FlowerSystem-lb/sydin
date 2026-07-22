"use client";

import { useState } from "react";
import { ActionButton } from "@/components/dashboard/Workspace";
import { DialogShell } from "@/components/ui/Overlay";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import { supabase } from "@/app/lib/supabase";
import type { UpgradePlan } from "@/app/lib/subscription";

export interface AlertLevelItem {
  id: number;
  name: string;
  quantity: number;
  min_stock_level?: number | null;
}

interface SetAlertLevelDialogContentProps {
  item: AlertLevelItem;
  defaultThreshold: number;
  canUseItemThreshold: boolean;
  currentPlanLabel: string;
  upgradePlan: UpgradePlan;
  onClose: () => void;
  onSaved: (itemId: number, minStockLevel: number | null) => void;
}

export default function SetAlertLevelDialog({
  open,
  item,
  ...contentProps
}: Omit<SetAlertLevelDialogContentProps, "item"> & {
  open: boolean;
  item: AlertLevelItem | null;
}) {
  if (!open || !item) return null;

  return (
    <SetAlertLevelDialogContent key={item.id} item={item} {...contentProps} />
  );
}

function SetAlertLevelDialogContent({
  item,
  defaultThreshold,
  canUseItemThreshold,
  currentPlanLabel,
  upgradePlan,
  onClose,
  onSaved,
}: SetAlertLevelDialogContentProps) {
  const [value, setValue] = useState(
    typeof item.min_stock_level === "number" && item.min_stock_level >= 0
      ? String(item.min_stock_level)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const saveAlertLevel = async (nextLevel: number | null) => {
    setSaving(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please sign in again to update this alert level.");
      setSaving(false);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("inventory")
      .update({ min_stock_level: nextLevel })
      .eq("id", item.id)
      .eq("user_id", user.id)
      .select("id, min_stock_level");

    if (updateError) {
      setError("We could not save the alert level. Please try again.");
      setSaving(false);
      return;
    }

    if (!data || data.length === 0) {
      setError("Item not found or you do not have access to update it.");
      setSaving(false);
      return;
    }

    await logInventoryHistory({
      itemId: item.id,
      userId: user.id,
      action: "edited",
      oldValues: { min_stock_level: item.min_stock_level ?? null },
      newValues: { min_stock_level: nextLevel },
    });

    onSaved(item.id, nextLevel);
    onClose();
  };

  const handleSave = () => {
    const trimmed = value.trim();

    if (!trimmed) {
      void saveAlertLevel(null);
      return;
    }

    const parsed = Number(trimmed);

    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Enter a whole number of 0 or more.");
      return;
    }

    void saveAlertLevel(parsed);
  };

  const hasCustomLevel =
    typeof item.min_stock_level === "number" && item.min_stock_level >= 0;

  return (
    <DialogShell
      eyebrow="Stock alert"
      title="Set alert level"
      description={item.name}
      onClose={onClose}
      closeDisabled={saving}
      footer={
        canUseItemThreshold ? (
          <div className="flex flex-wrap justify-end gap-2">
            {hasCustomLevel && (
              <ActionButton
                variant="secondary"
                disabled={saving}
                onClick={() => void saveAlertLevel(null)}
              >
                Use default ({defaultThreshold})
              </ActionButton>
            )}
            <ActionButton variant="ghost" disabled={saving} onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton icon="check" disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save alert level"}
            </ActionButton>
          </div>
        ) : undefined
      }
    >
      {canUseItemThreshold ? (
        <div className="grid gap-3">
          <p className="text-sm leading-6 text-theme-muted">
            You get a low-stock alert when this item&apos;s stock is at or
            below its alert level. Current stock: {item.quantity}.
          </p>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-theme-secondary">
              Alert when stock reaches
            </span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={value}
              disabled={saving}
              placeholder={`Business default (${defaultThreshold})`}
              onKeyDown={(event) => {
                if (["-", "+", "e", "E", "."].includes(event.key)) {
                  event.preventDefault();
                }
              }}
              onChange={(event) => {
                setValue(
                  event.target.value.startsWith("-")
                    ? ""
                    : event.target.value
                );
                setError("");
              }}
              className="w-full rounded-xl border border-theme bg-theme-inset px-3 py-2.5 text-sm text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
            />
          </label>
          <p className="text-xs leading-5 text-theme-subtle">
            Leave empty to use your business default ({defaultThreshold}).
            Change the default in Settings.
          </p>
          {error && (
            <p role="alert" className="text-sm font-semibold text-theme-danger">
              {error}
            </p>
          )}
        </div>
      ) : (
        <LockedFeaturePanel
          compact
          feature="Custom alert levels"
          benefit={`Set a different low-stock alert level for each item. On your current plan every item alerts at the fixed level of ${defaultThreshold}.`}
          currentPlan={currentPlanLabel}
          requiredPlan={upgradePlan}
          source="set-alert-level"
        />
      )}
    </DialogShell>
  );
}
