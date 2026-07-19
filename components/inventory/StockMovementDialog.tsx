"use client";

import { useState } from "react";
import { DialogShell, Select } from "@/components/ui";
import {
  recordStockMovement,
  STOCK_MOVEMENT_LABELS,
  type StockMovement,
  type StockMovementType,
} from "@/app/lib/stockMovements";

export interface MovementInventoryItem {
  id: number;
  name: string;
  quantity: number;
  sku?: string | null;
}

const movementTypes = Object.keys(
  STOCK_MOVEMENT_LABELS
) as StockMovementType[];

export default function StockMovementDialog({
  open,
  items,
  initialItemId,
  onClose,
  onRecorded,
}: {
  open: boolean;
  items: MovementInventoryItem[];
  initialItemId?: number | null;
  onClose: () => void;
  onRecorded: (movement: StockMovement, itemId: number) => void | Promise<void>;
}) {
  if (!open) return null;

  return (
    <StockMovementDialogContent
      items={items}
      initialItemId={initialItemId}
      onClose={onClose}
      onRecorded={onRecorded}
    />
  );
}

function StockMovementDialogContent({
  items,
  initialItemId,
  onClose,
  onRecorded,
}: {
  items: MovementInventoryItem[];
  initialItemId?: number | null;
  onClose: () => void;
  onRecorded: (movement: StockMovement, itemId: number) => void | Promise<void>;
}) {
  const [itemId, setItemId] = useState(
    initialItemId ? String(initialItemId) : ""
  );
  const [movementType, setMovementType] =
    useState<StockMovementType>("stock_in");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedItem = items.find((item) => item.id === Number(itemId));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const quantityValue = Number(quantity);

    if (!selectedItem) {
      setError("Choose an inventory item.");
      return;
    }

    if (
      quantity === "" ||
      !Number.isFinite(quantityValue) ||
      !Number.isInteger(quantityValue) ||
      quantityValue < 0
    ) {
      setError("Enter a whole quantity of 0 or more.");
      return;
    }

    if (
      (movementType === "stock_out" || movementType === "damaged_lost") &&
      selectedItem.quantity - quantityValue < 0
    ) {
      setError("This movement would make the item quantity negative.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const movement = await recordStockMovement({
        itemId: selectedItem.id,
        movementType,
        quantity: quantityValue,
        notes,
      });

      await onRecorded(movement, selectedItem.id);
      onClose();
    } catch (movementError) {
      setError(
        movementError instanceof Error
          ? movementError.message
          : "We could not record this movement. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title="Record Movement"
      eyebrow="Stock activity"
      description="Update item quantity through the existing SydIN movement history."
      onClose={onClose}
      closeDisabled={saving}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div>
          <Select
            id="movement-item"
            label="Inventory item"
            value={itemId}
            onChange={(value) => {
              setItemId(value);
              setError("");
            }}
            disabled={saving}
            placeholder="Choose an item"
            searchable
            searchPlaceholder="Search inventory items"
            options={items.map((item) => ({
              value: String(item.id),
              label: item.name,
              description: `${item.sku ? `${item.sku} · ` : ""}${
                item.quantity
              } in stock`,
              keywords: item.sku || "",
            }))}
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-bold text-theme-secondary">
            Movement type
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {movementTypes.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={movementType === type}
                onClick={() => {
                  setMovementType(type);
                  setError("");
                }}
                disabled={saving}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${
                  movementType === type
                    ? "border-[#2563eb]/60 bg-[#2563eb]/15 text-theme-accent ring-4 ring-[#2563eb]/10"
                    : "border-theme bg-theme-surface text-theme-secondary hover:bg-theme-hover"
                }`}
              >
                {STOCK_MOVEMENT_LABELS[type]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
          <div>
            <label
              htmlFor="movement-quantity"
              className="mb-2 block text-sm font-bold text-theme-secondary"
            >
              {movementType === "adjustment" ? "Final quantity" : "Quantity"}
            </label>
            <input
              id="movement-quantity"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                setError("");
              }}
              disabled={saving}
              className="w-full rounded-xl border border-theme bg-theme-surface px-4 py-3 text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
              required
            />
          </div>
          <div>
            <label
              htmlFor="movement-notes"
              className="mb-2 block text-sm font-bold text-theme-secondary"
            >
              Reason or note
            </label>
            <input
              id="movement-notes"
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={saving}
              placeholder="Optional context for this movement"
              className="w-full rounded-xl border border-theme bg-theme-surface px-4 py-3 text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
            />
          </div>
        </div>

        {selectedItem && (
          <p className="rounded-xl border border-theme bg-theme-inset px-4 py-3 text-sm text-theme-secondary">
            Current quantity:{" "}
            <strong className="text-theme-primary">
              {selectedItem.quantity}
            </strong>
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-theme bg-theme-surface px-5 py-3 text-sm font-bold text-theme-primary hover:bg-theme-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[linear-gradient(135deg,#10c4dc,#2563eb_58%,#7d5cff)] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.16)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Recording..." : "Record Movement"}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}
