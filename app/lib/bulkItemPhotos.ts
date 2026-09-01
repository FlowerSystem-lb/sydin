import {
  getImageValidationError,
  getPhotoFileKey,
} from "@/app/lib/productImage";

/**
 * Attaching photos to items that ALREADY exist, many at a time.
 *
 * The Excel/CSV import can already carry photos (see `matchImportPhotosToRows`).
 * This is the other half of the same job: a depot has 300 items in SydIN and a
 * folder of photos on a laptop, and no import to hang them on.
 *
 * The matching rule is deliberately the same one, because a second rule is a
 * second thing to be wrong about:
 *
 *   Founder's rule — "Do NOT match photos to rows by order (1,2,3,4). One
 *   failed upload or a phone sorting by date instead of name shifts every
 *   subsequent photo onto the wrong item, silently."
 *
 * So order is never used. A file finds its item by name, or it finds nothing
 * and says so.
 *
 * Two differences from the import matcher, both on purpose:
 *
 * 1. It matches on SKU, then barcode, then item code, then the exact product
 *    name. The import only had SKU because an import row has little else that
 *    is reliably unique yet. A saved item has all four, and a shop that names
 *    photos after the barcode it scanned is doing something reasonable.
 * 2. A file may be assigned to an item BY HAND. Photos off a phone are called
 *    `IMG_5383.jpg`, and no one is renaming 40 of those. Manual assignment is
 *    still not positional: the person picks the item while looking at the
 *    photo, which is the opposite of a silent scramble.
 */

export type PhotoMatchField = "sku" | "barcode" | "item_code" | "name" | "manual";

export interface PhotoTargetItem {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  item_code?: string | null;
  image?: string | null;
}

export interface BulkPhotoMatch {
  file: File;
  item: PhotoTargetItem;
  matchedOn: PhotoMatchField;
  /** The item already has a photo, and importing will replace it. */
  replacesExisting: boolean;
}

export interface BulkPhotoRejectedFile {
  file: File;
  reason: string;
}

export interface BulkPhotoDuplicate {
  file: File;
  item: PhotoTargetItem;
}

export interface BulkPhotoMatchResult {
  /** One file per item, order-independent — the whole point of this function. */
  matches: BulkPhotoMatch[];
  /** Nothing in the inventory is called this. Assign by hand or rename. */
  unmatched: File[];
  /** An item already claimed by an earlier file in the list. */
  duplicates: BulkPhotoDuplicate[];
  /** Wrong type or too large. Never silently dropped. */
  invalid: BulkPhotoRejectedFile[];
}

function normalise(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function stripExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return (dot > 0 ? fileName.slice(0, dot) : fileName).trim().toLowerCase();
}

/**
 * The import matcher validates a file only once it has found a row, so a bad
 * file that matches nothing is reported as "no match" rather than "bad file".
 * Here validation runs first, because the single most likely bad file is an
 * iPhone `.HEIC`, and "no item is called IMG_5383" would send someone hunting
 * for the wrong problem.
 */
function getBulkPhotoValidationError(file: File) {
  const error = getImageValidationError(file);
  if (!error) return "";

  if (/\.heic$|\.heif$/i.test(file.name)) {
    return "iPhone HEIC photo — on the phone set Camera > Formats to \u201cMost Compatible\u201d, or export it as JPG first.";
  }

  return error;
}

export function matchPhotosToItems(
  files: File[],
  items: PhotoTargetItem[],
  /** file key -> item id, chosen by hand for files nothing matched. */
  manualAssignments: Map<string, number> = new Map()
): BulkPhotoMatchResult {
  const itemById = new Map<number, PhotoTargetItem>();
  const bySku = new Map<string, PhotoTargetItem>();
  const byBarcode = new Map<string, PhotoTargetItem>();
  const byItemCode = new Map<string, PhotoTargetItem>();
  const byName = new Map<string, PhotoTargetItem>();

  // First writer wins on every index, so two items sharing a name or a blank
  // code can never make the match depend on load order.
  const claimFirst = (
    index: Map<string, PhotoTargetItem>,
    key: string,
    item: PhotoTargetItem
  ) => {
    if (key && !index.has(key)) index.set(key, item);
  };

  for (const item of items) {
    itemById.set(item.id, item);
    claimFirst(bySku, normalise(item.sku), item);
    claimFirst(byBarcode, normalise(item.barcode), item);
    claimFirst(byItemCode, normalise(item.item_code), item);
    claimFirst(byName, normalise(item.name), item);
  }

  const matches: BulkPhotoMatch[] = [];
  const unmatched: File[] = [];
  const duplicates: BulkPhotoDuplicate[] = [];
  const invalid: BulkPhotoRejectedFile[] = [];
  const claimedItemIds = new Set<number>();

  for (const file of files) {
    const validationError = getBulkPhotoValidationError(file);
    if (validationError) {
      invalid.push({ file, reason: validationError });
      continue;
    }

    const manualItemId = manualAssignments.get(getPhotoFileKey(file));
    const manualItem = manualItemId ? itemById.get(manualItemId) : undefined;

    const stem = stripExtension(file.name);
    const found: { item: PhotoTargetItem; matchedOn: PhotoMatchField } | null =
      manualItem
        ? { item: manualItem, matchedOn: "manual" }
        : bySku.has(stem)
          ? { item: bySku.get(stem)!, matchedOn: "sku" }
          : byBarcode.has(stem)
            ? { item: byBarcode.get(stem)!, matchedOn: "barcode" }
            : byItemCode.has(stem)
              ? { item: byItemCode.get(stem)!, matchedOn: "item_code" }
              : byName.has(stem)
                ? { item: byName.get(stem)!, matchedOn: "name" }
                : null;

    if (!found) {
      unmatched.push(file);
      continue;
    }

    if (claimedItemIds.has(found.item.id)) {
      // Two files for one item. Keep the first and show the second, rather
      // than overwriting silently — a silent overwrite is exactly the kind of
      // mismatch the founder's rule exists to prevent.
      duplicates.push({ file, item: found.item });
      continue;
    }

    claimedItemIds.add(found.item.id);
    matches.push({
      file,
      item: found.item,
      matchedOn: found.matchedOn,
      replacesExisting: Boolean(found.item.image),
    });
  }

  return { matches, unmatched, duplicates, invalid };
}
