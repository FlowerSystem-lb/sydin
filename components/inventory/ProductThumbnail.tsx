"use client";

import Image from "next/image";
import { useState } from "react";
import UiIcon from "@/components/UiIcon";

/**
 * A product photo that degrades instead of breaking.
 *
 * Why this is shared, 2 Sep 2026
 * -----------------------------
 * Eighteen screens draw a product photo. Two of them handled the photo failing
 * to load; the other sixteen rendered the browser's torn-page glyph, which is
 * the one image a customer must never see in an inventory they are trusting.
 *
 * It is not a rare case. It happens whenever the file is gone from storage,
 * the connection drops mid-load, or -- the case that started this -- something
 * between the app and Supabase breaks the image request. Measured on this
 * machine: with a TLS-intercepting VPN running, every single product photo
 * failed, and every screen except the Inventory grid showed a broken icon
 * rather than the neutral box it shows when an item simply has no photo.
 *
 * The rule this encodes: "no photo" and "photo did not load" look the same to
 * the person standing in the depot, because to them they ARE the same -- they
 * cannot see the product either way. So they get the same calm placeholder.
 *
 * `failedSrc` holds the src that failed rather than a boolean, so pointing the
 * component at a different photo clears the failure by itself; a boolean would
 * stay stuck after the item was edited.
 */
export default function ProductThumbnail({
  src,
  alt,
  sizes = "64px",
  imgClassName = "object-contain p-1.5",
  iconClassName = "h-5 w-5",
  fallbackClassName = "flex h-full w-full items-center justify-center text-theme-subtle",
  priority = false,
  width,
  height,
}: {
  src?: string | null;
  alt: string;
  /** Row thumbnails are 44-56px; asking for the full upload wastes megabytes. */
  sizes?: string;
  /**
   * Give both to draw at a fixed size instead of filling. `fill` needs a
   * positioned parent, and a few older thumbs (the Overview list) are plain
   * inline-flex boxes; sizing them here beats changing their CSS.
   */
  width?: number;
  height?: number;
  imgClassName?: string;
  iconClassName?: string;
  fallbackClassName?: string;
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && failedSrc !== src) {
    const sizeProps =
      width && height
        ? { width, height }
        : ({ fill: true, sizes } as const);

    return (
      <Image
        src={src}
        alt={alt}
        {...sizeProps}
        loading={priority ? "eager" : "lazy"}
        priority={priority}
        draggable={false}
        onError={() => setFailedSrc(src)}
        className={imgClassName}
      />
    );
  }

  return (
    <span className={fallbackClassName}>
      <UiIcon name="box" className={iconClassName} />
    </span>
  );
}
