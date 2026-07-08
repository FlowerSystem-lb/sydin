export interface LoadedExportImage {
  dataUrl: string;
  extension: "jpeg" | "png";
  width: number;
  height: number;
}

function getImageExtension(url: string, contentType: string | null) {
  const normalizedContentType = (contentType || "").toLowerCase();
  const normalizedUrl = url.toLowerCase();

  if (normalizedContentType.includes("png")) return "png";
  if (
    normalizedContentType.includes("jpeg") ||
    normalizedContentType.includes("jpg")
  ) {
    return "jpeg";
  }

  if (normalizedUrl.endsWith(".png")) return "png";
  if (normalizedUrl.endsWith(".jpg") || normalizedUrl.endsWith(".jpeg")) {
    return "jpeg";
  }

  return null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function getImageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = dataUrl;
  });
}

/** Fetches a remote image and returns base64 data usable by jsPDF/ExcelJS. Returns null on any failure. */
export async function loadExportImage(
  imageUrl: string,
  maxBytes = 1_500_000
): Promise<LoadedExportImage | null> {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (blob.size > maxBytes) return null;

    const extension = getImageExtension(
      imageUrl,
      response.headers.get("content-type")
    );
    if (!extension) return null;

    const dataUrl = await blobToDataUrl(blob);
    const dimensions = await getImageDimensions(dataUrl);

    return { dataUrl, extension, ...dimensions };
  } catch {
    return null;
  }
}

export function getContainedImageSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }

  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return { width: sourceWidth * ratio, height: sourceHeight * ratio };
}
