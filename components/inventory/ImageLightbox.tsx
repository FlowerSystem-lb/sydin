"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import UiIcon from "@/components/UiIcon";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;

/**
 * Full-screen viewer for a single product image.
 *
 * Item photos are labels and packaging — the detail that matters (a code, a
 * variant name, damage) is often unreadable at card size. Zoom is scroll wheel
 * or the +/- controls, panning is drag once zoomed in, and Escape / the scrim /
 * the close button all dismiss it.
 *
 * Deliberately dependency-free: SydIN's decision log rules out adding animation
 * or lightbox libraries, so this is plain transform maths.
 */
export default function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [rawOffset, setRawOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // The parent mounts this only while it is open, so zoom and pan reset by
  // unmounting rather than by an effect that re-syncs state on every change.

  const clampZoom = (value: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));

  /**
   * Takes a delta and updates from the previous value rather than from a
   * captured one. Reading `zoom` from the closure meant several clicks landing
   * in the same render all computed from the same starting value, so clicking
   * zoom-in quickly advanced a single step instead of one per click.
   */
  const applyZoomDelta = useCallback((delta: number) => {
    setZoom((previous) => clampZoom(previous + delta));
  }, []);

  // At 1x there is nothing to pan to, so the offset is ignored rather than
  // written back to state — derived, so it costs no extra render and the image
  // can never be left parked off-screen.
  const offset = zoom === MIN_ZOOM ? { x: 0, y: 0 } : rawOffset;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        applyZoomDelta(ZOOM_STEP);
      } else if (event.key === "-") {
        event.preventDefault();
        applyZoomDelta(-ZOOM_STEP);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applyZoomDelta, onClose]);

  // The page behind must not scroll while the viewer owns the screen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (typeof document === "undefined") return null;

  const zoomed = zoom > MIN_ZOOM;

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — enlarged view`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="image-lightbox-toolbar">
        <button
          type="button"
          onClick={() => applyZoomDelta(-ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
        >
          <UiIcon name="chevron-down" className="h-4 w-4" />
        </button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => applyZoomDelta(ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
        >
          <UiIcon name="chevron-up" className="h-4 w-4" />
        </button>
        <button
          autoFocus
          type="button"
          onClick={onClose}
          aria-label="Close enlarged view"
        >
          <UiIcon name="close" className="h-4 w-4" />
        </button>
      </div>

      <div
        className="image-lightbox-stage"
        onWheel={(event) => {
          applyZoomDelta(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
        }}
        onMouseDown={(event) => {
          if (!zoomed) return;
          dragRef.current = {
            x: event.clientX - offset.x,
            y: event.clientY - offset.y,
          };
        }}
        onMouseMove={(event) => {
          if (!dragRef.current) return;
          setRawOffset({
            x: event.clientX - dragRef.current.x,
            y: event.clientY - dragRef.current.y,
          });
        }}
        onMouseUp={() => {
          dragRef.current = null;
        }}
        onMouseLeave={() => {
          dragRef.current = null;
        }}
        style={{ cursor: zoomed ? "grab" : "default" }}
      >
        <div
          className="image-lightbox-frame"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            unoptimized
            sizes="100vw"
            className="object-contain"
            draggable={false}
          />
        </div>
      </div>

      <p className="image-lightbox-hint">
        Scroll to zoom{zoomed ? " · drag to pan" : ""} · Esc to close
      </p>
    </div>,
    document.body
  );
}
