/**
 * Friendly camera/scanner error copy.
 *
 * Extracted verbatim from the inventory workspace scanner so the Inventory
 * modal and the Scanner Workspace report identical messages.
 */
export function getScannerErrorMessage(error: unknown) {
  const errorName =
    error instanceof DOMException
      ? error.name
      : error &&
          typeof error === "object" &&
          "name" in error &&
          typeof error.name === "string"
        ? error.name
        : "";

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return "Camera permission was denied. Allow camera access and try again.";
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return "The camera is already in use by another app or browser tab.";
  }

  if (errorName === "OverconstrainedError") {
    return "We could not start the preferred camera. Try another browser or device.";
  }

  return "Scanner failed. Close it and try again.";
}

export const SCANNER_UNSUPPORTED_MESSAGE =
  "This browser does not support camera scanning.";

export const SCANNER_PREVIEW_NOT_READY_MESSAGE =
  "Scanner preview is not ready. Close it and try again.";
