"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, DialogShell, Select } from "@/components/ui";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";
import {
  ALLOWED_IMAGE_TYPES,
  createProductImagePath,
  prepareProductImage,
  getPhotoFileKey,
} from "@/app/lib/productImage";
import {
  matchPhotosToItems,
  buildPlaceholderItemName,
  type PhotoMatchField,
  type PhotoTargetItem,
} from "@/app/lib/bulkItemPhotos";
import { DEFAULT_INVENTORY_UNIT_TYPE } from "@/app/lib/inventoryItemModel";

/**
 * Photos for items that already exist, many at once.
 *
 * The import screen can carry photos alongside a spreadsheet. This covers the
 * other case, which is the common one after the first month: the items are
 * already in SydIN, and the photos arrive later from a phone or a supplier.
 *
 * The matching rule lives in `matchPhotosToItems`, not here, so it can be read
 * on its own. This file is only the screen around it.
 */

const MATCH_LABEL: Record<PhotoMatchField, string> = {
  sku: "SKU",
  barcode: "Barcode",
  item_code: "Item code",
  name: "Name",
  manual: "Chosen by you",
};

/**
 * Storage and the database are two calls per photo; four at a time keeps a
 * 40-photo batch from opening 80 connections at once on a depot's internet.
 */
const UPLOAD_CONCURRENCY = 4;

interface BulkPhotoDialogProps {
  open: boolean;
  items: PhotoTargetItem[];
  businessName: string;
  onClose: () => void;
  onUploaded: (attached: number) => void;
}

export default function BulkPhotoDialog({
  open,
  items,
  businessName,
  onClose,
  onUploaded,
}: BulkPhotoDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [manualAssignments, setManualAssignments] = useState<Map<string, number>>(
    new Map()
  );
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    attached: number;
    created: number;
    failed: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const match = useMemo(
    () => matchPhotosToItems(files, items, manualAssignments),
    [files, items, manualAssignments]
  );

  /**
   * A photo matching nothing does not need a person to sit and assign it to
   * an existing item any more -- that item usually does not exist yet, which
   * was the whole problem. It becomes a brand-new item instead, named from
   * the business (Settings) plus a running number that continues past the
   * current inventory count, and the photo attaches to that. The Select
   * next to it is still there for the case that DOES have a match already
   * on the shelf, just spelled differently than its file name.
   */
  const newItemPlans = useMemo(() => {
    const startingAt = items.length + 1;
    return match.unmatched.map((file, index) => ({
      file,
      name: buildPlaceholderItemName(businessName, startingAt + index),
    }));
  }, [match.unmatched, items.length, businessName]);

  /**
   * One object URL per file, revoked when that set of files is replaced.
   * Without this a 40-photo batch leaks a blob per file on every change.
   */
  const previewUrls = useMemo(() => {
    const urls = new Map<string, string>();
    for (const file of files) {
      urls.set(getPhotoFileKey(file), URL.createObjectURL(file));
    }
    return urls;
  }, [files]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: String(item.id),
        label: item.name || `Item ${item.id}`,
        description: item.sku || item.barcode || item.item_code || undefined,
        keywords: [item.sku, item.barcode, item.item_code]
          .filter(Boolean)
          .join(" "),
      })),
    [items]
  );

  const reset = () => {
    setFiles([]);
    setManualAssignments(new Map());
    setError("");
    setResult(null);
    setUploadedCount(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const addFiles = (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    setResult(null);
    setError("");
    setFiles((current) => {
      const seen = new Set(current.map(getPhotoFileKey));
      return [
        ...current,
        ...incoming.filter((file) => !seen.has(getPhotoFileKey(file))),
      ];
    });
  };

  const removeFile = (target: File) => {
    const key = getPhotoFileKey(target);
    setFiles((current) => current.filter((file) => getPhotoFileKey(file) !== key));
    setManualAssignments((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };

  const assignFile = (file: File, itemId: string) => {
    const key = getPhotoFileKey(file);
    setManualAssignments((current) => {
      const next = new Map(current);
      if (itemId) {
        next.set(key, Number(itemId));
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const attachPhotos = async () => {
    const totalTasks = match.matches.length + newItemPlans.length;
    if (uploading || totalTasks === 0) return;

    setUploading(true);
    setError("");
    setUploadedCount(0);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Your session expired. Sign in again and retry.");
      setUploading(false);
      return;
    }

    let attached = 0;
    let created = 0;
    let failed = 0;
    type Task =
      | { kind: "update"; file: File; itemId: number }
      | { kind: "create"; file: File; name: string };
    const queue: Task[] = [
      ...match.matches.map(
        (m): Task => ({ kind: "update", file: m.file, itemId: m.item.id })
      ),
      ...newItemPlans.map(
        (plan): Task => ({ kind: "create", file: plan.file, name: plan.name })
      ),
    ];

    /**
     * A failed photo does not abort the batch — the same call the import
     * screen makes, for the same reason: 39 good photos should not be lost to
     * one bad file. Failures are counted and reported, never hidden.
     */
    const worker = async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;

        try {
          const upload = await prepareProductImage(next.file);
          const path = createProductImagePath(user.id, upload);
          const { error: uploadError } = await supabase.storage
            .from("products")
            .upload(path, upload);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from("products").getPublicUrl(path);

          if (next.kind === "update") {
            const { error: updateError } = await supabase
              .from("inventory")
              .update({ image: data.publicUrl })
              .eq("id", next.itemId)
              .eq("user_id", user.id);

            if (updateError) throw updateError;
            attached += 1;
          } else {
            // Same minimal shape AddItemForm inserts with, everything not
            // derivable from a bare photo left at its ordinary default —
            // this is a placeholder row, not a shortcut around required
            // fields, and every one of them stays editable from Inventory.
            const { error: insertError } = await supabase.from("inventory").insert([
              {
                name: next.name,
                sku: "",
                barcode: null,
                category: null,
                category_id: null,
                quantity: 0,
                unit_type: DEFAULT_INVENTORY_UNIT_TYPE,
                custom_unit_label: null,
                cost_price: null,
                selling_price: null,
                min_stock_level: null,
                notes: null,
                image: data.publicUrl,
                depot_id: null,
                supplier_id: null,
                user_id: user.id,
              },
            ]);

            if (insertError) throw insertError;
            created += 1;
          }
        } catch {
          failed += 1;
        } finally {
          setUploadedCount((current) => current + 1);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker)
    );

    setUploading(false);
    setResult({ attached, created, failed });
    setFiles([]);
    setManualAssignments(new Map());
    if (inputRef.current) inputRef.current.value = "";
    if (attached + created > 0) onUploaded(attached + created);
  };

  const closeDialog = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  if (!open) return null;

  const totalToUpload = match.matches.length + newItemPlans.length;

  return (
    <DialogShell
      title="Add photos to many items"
      eyebrow="Bulk photos"
      description="Name each photo after the item's SKU, barcode, item code, or exact name to attach it there. Anything that matches nothing becomes a new item instead — no details to type, just the photo — ready to fill in from Inventory."
      onClose={closeDialog}
      closeDisabled={uploading}
      className="inventory-bulk-photo-dialog"
      footer={
        <>
          <Button variant="secondary" onClick={closeDialog} disabled={uploading}>
            {result ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={() => void attachPhotos()}
            disabled={uploading || totalToUpload === 0}
            loading={uploading}
            loadingLabel={`Uploading ${uploadedCount} of ${totalToUpload}...`}
          >
            {totalToUpload > 0
              ? `Attach ${totalToUpload} photo${totalToUpload === 1 ? "" : "s"}`
              : "Attach photos"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-theme-success">
            {result.attached > 0
              ? `${result.attached} photo${result.attached === 1 ? "" : "s"} attached to existing items. `
              : ""}
            {result.created > 0
              ? `${result.created} new item${result.created === 1 ? "" : "s"} created. `
              : ""}
            {result.failed > 0
              ? `${result.failed} could not be uploaded — nothing was changed for those.`
              : ""}
          </div>
        )}

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget === event.target) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          className={`rounded-2xl border border-dashed p-3 transition ${
            isDragging
              ? "border-sydin-blue/60 bg-sydin-blue/15"
              : "border-sydin-blue/25 bg-theme-inset"
          }`}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex min-h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-center transition hover:bg-[var(--sydin-input-bg)] disabled:opacity-50"
          >
            <UiIcon name="upload" className="h-5 w-5 text-theme-accent" />
            <span className="text-sm font-semibold text-theme-primary">
              Drop photos here or choose from device
            </span>
            <span className="text-xs text-theme-subtle">
              JPG, PNG or WebP — 5MB max each
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
            className="sr-only"
          />
        </div>

        {files.length > 0 && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <SummaryTile label="Matched" value={match.matches.length} tone="good" />
            <SummaryTile
              label="New items"
              value={newItemPlans.length}
              tone={newItemPlans.length > 0 ? "warn" : "quiet"}
            />
            <SummaryTile
              label="Duplicate"
              value={match.duplicates.length}
              tone={match.duplicates.length > 0 ? "warn" : "quiet"}
            />
            <SummaryTile
              label="Cannot use"
              value={match.invalid.length}
              tone={match.invalid.length > 0 ? "bad" : "quiet"}
            />
          </div>
        )}

        {newItemPlans.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold text-theme-primary">
              Will become new items
            </h3>
            <p className="text-xs text-theme-subtle">
              Nothing on the shelf is named or coded like these files, so each
              becomes its own new item with a placeholder name — rename it and
              fill in the rest from Inventory whenever. Already have the item?
              Pick it below instead and the photo attaches there.
            </p>
            <ul className="grid max-h-64 gap-2 overflow-y-auto pr-1">
              {newItemPlans.map(({ file, name }) => (
                <li
                  key={getPhotoFileKey(file)}
                  className="flex items-center gap-3 rounded-xl border border-amber-300/25 bg-amber-500/[0.07] p-2"
                >
                  <PhotoThumb src={previewUrls.get(getPhotoFileKey(file))} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-theme-secondary">
                      {file.name}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-theme-primary">
                      Will create: {name}
                    </p>
                    <div className="mt-1.5">
                      <Select
                        value=""
                        options={itemOptions}
                        onChange={(value) => assignFile(file, value)}
                        ariaLabel={`Item for ${file.name}`}
                        placeholder="Or pick an existing item instead"
                        searchable
                        searchPlaceholder="Search by name, SKU or barcode"
                        disabled={uploading}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(file)}
                    disabled={uploading}
                    className="shrink-0 self-start text-xs font-semibold text-theme-muted hover:text-theme-danger"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {match.matches.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold text-theme-primary">
              Ready to attach
            </h3>
            <ul className="grid max-h-64 gap-2 overflow-y-auto pr-1">
              {match.matches.map(({ file, item, matchedOn, replacesExisting }) => (
                <li
                  key={getPhotoFileKey(file)}
                  className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-2"
                >
                  <PhotoThumb src={previewUrls.get(getPhotoFileKey(file))} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-theme-primary">
                      {item.name || `Item ${item.id}`}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-theme-subtle">
                      {MATCH_LABEL[matchedOn]}
                      {replacesExisting ? " · replaces the current photo" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(file)}
                    disabled={uploading}
                    className="shrink-0 text-xs font-semibold text-theme-muted hover:text-theme-danger"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {match.duplicates.length > 0 && (
          <section className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-theme-warning">
              An earlier photo already claimed this item — not uploaded
            </p>
            <ul className="mt-2 grid gap-1">
              {match.duplicates.map(({ file, item }) => (
                <li
                  key={getPhotoFileKey(file)}
                  className="text-xs text-theme-secondary"
                >
                  <span className="font-mono">{file.name}</span> → {item.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {match.invalid.length > 0 && (
          <section className="rounded-xl border border-red-400/25 bg-red-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-theme-danger">
              Cannot be used
            </p>
            <ul className="mt-2 grid gap-1">
              {match.invalid.map(({ file, reason }) => (
                <li
                  key={getPhotoFileKey(file)}
                  className="text-xs text-theme-secondary"
                >
                  <span className="font-mono">{file.name}</span> — {reason}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </DialogShell>
  );
}

function PhotoThumb({ src }: { src?: string }) {
  if (!src) {
    return <div className="h-11 w-11 shrink-0 rounded-lg bg-theme-inset" />;
  }

  return (
    <Image
      src={src}
      alt=""
      width={44}
      height={44}
      unoptimized
      className="h-11 w-11 shrink-0 rounded-lg object-cover"
    />
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "bad" | "quiet";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-500/10"
      : tone === "warn"
        ? "border-amber-300/25 bg-amber-500/10"
        : tone === "bad"
          ? "border-red-400/20 bg-red-500/10"
          : "border-theme bg-theme-inset";

  return (
    <div className={`rounded-xl border p-2.5 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-theme-muted">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-theme-primary">{value}</p>
    </div>
  );
}
