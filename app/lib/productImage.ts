/**
 * One place that decides how a product photo is validated and where it is stored.
 *
 * Why this file exists
 * --------------------
 * There were four upload sites and two behaviours. Add Item and CSV Import each
 * had their own private copy of these helpers and wrote to
 * `<user-id>/<timestamp>-<uuid>.<ext>`. The two edit screens — the Inventory list
 * and the item detail page — did neither: they wrote
 * `` `${Date.now()}-${editImage.name}` `` straight to the root of the bucket,
 * keeping the browser's original filename.
 *
 * That mattered for three reasons:
 *
 * 1. Storage security has to be enforced by the folder. A rule can check that the
 *    first path segment is the uploader's id; it cannot check anything about a
 *    file dropped at the bucket root. So the storage policy could not be tightened
 *    while two screens still uploaded that way.
 * 2. The original filename is user-controlled input, and it was being trusted.
 *    Real files already in the bucket include
 *    `1780685501185-ChatGPT Image May 9, 2026, 10_31_24 PM.png` — spaces, commas
 *    and all.
 * 3. Two of the four screens validated size and type; the edit screens did not.
 *
 * All four now import from here.
 *
 * The browser is not the enforcement point
 * ----------------------------------------
 * These checks are for a helpful error message, not for security — the key the
 * browser holds is public, so anything here can be bypassed by calling Supabase
 * directly. The real limits live on the bucket itself (`file_size_limit`,
 * `allowed_mime_types`) and in the storage policies. Keep the two in step: if the
 * numbers below change, change the bucket to match.
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** Empty string means the file is acceptable. */
export function getImageValidationError(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Choose a JPG, PNG, or WebP image.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "Image must be 5MB or smaller.";
  }

  return "";
}

/**
 * Identifies one chosen file across re-renders, so a photo can be remembered
 * after it has been assigned to a row or an item by hand. Name alone is not
 * enough — two folders can each hold an `IMG_5383.jpg`.
 */
export function getPhotoFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * The extension is derived from the MIME type we already allowed, never taken
 * from the filename — that is what keeps `evil.php.jpg` from surviving the trip.
 */
export function getImageExtension(file: File) {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensionByType[file.type] || "jpg";
}

/**
 * `<user-id>/<timestamp>-<random>.<ext>`
 *
 * The leading folder is not cosmetic: the storage policy checks it, so a photo
 * saved anywhere else is both unprotected and, once the policy is tightened,
 * rejected. Nothing from the original filename is carried over.
 */
export function createProductImagePath(userId: string, file: File) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);

  return `${userId}/${Date.now()}-${random}.${getImageExtension(file)}`;
}

/**
 * Longest edge of a stored product photo, in pixels. The largest place a
 * photo is shown is the item page at ~640px wide; 1600 leaves room for a
 * retina screen and a zoomed detail without storing a 4000px original.
 */
export const PRODUCT_IMAGE_MAX_EDGE = 1600;

/** Below this, a photo is left exactly as chosen -- re-encoding would only lose quality. */
const PRODUCT_IMAGE_KEEP_UNDER = 600 * 1024;

/**
 * Shrinks a chosen photo before it is uploaded.
 *
 * Why: nothing compressed uploads. A phone photo went to the bucket as a
 * 3-5MB original and that is what every card in the grid then pulled down --
 * measured on 19 Sep: a 1.1MB photo timed out in the image optimizer on
 * first load. Point 54 of the redesign brief ("image sizes").
 *
 * What it does: decodes the file (honouring the camera's orientation flag),
 * scales it to at most PRODUCT_IMAGE_MAX_EDGE on the long side, and
 * re-encodes -- JPEG at 0.82 for photos, PNG stays PNG so a logo keeps its
 * transparency. Small files are returned untouched.
 *
 * What it never does: throw, or return something worse. Any failure (an
 * image the browser cannot decode, no canvas, a server render) returns the
 * original file, so the upload still happens exactly as before. The
 * validation in getImageValidationError runs on the ORIGINAL, before this.
 */
export async function prepareProductImage(file: File): Promise<File> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, PRODUCT_IMAGE_MAX_EDGE / longest);

    if (scale === 1 && file.size <= PRODUCT_IMAGE_KEEP_UNDER) {
      bitmap.close();
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, 0.82)
    );

    // A re-encode that came out bigger is not an improvement.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], `photo.${outputType === "image/png" ? "png" : "jpg"}`, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
