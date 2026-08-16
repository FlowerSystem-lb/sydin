"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export default function Reveal({
  children,
  className = "",
  delay = 0,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Starts false so the server-rendered markup carries no "hidden" state:
  // the CSS only dims a Reveal once this flips, so with JS disabled, JS still
  // loading, or an observer that never fires, the content is simply visible.
  // Opting *in* to the animation is the only safe direction here -- the
  // opposite (hide by default, reveal on scroll) risks a blank marketing page.
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Honour the OS setting directly rather than relying on the CSS media
    // query alone: with reduced motion we never arm, so the element is never
    // dimmed and there is nothing to animate back from.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      return;
    }

    // Anything already on screen at mount (the hero, above-the-fold cards)
    // must not animate -- it would flash out and back in on every load.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      return;
    }

    setArmed(true);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      // Fire slightly before the element's edge clears the viewport, so the
      // motion reads as the section arriving rather than catching up.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`sydin-reveal ${shown ? "sydin-reveal-visible" : ""} ${className}`}
      data-reveal-armed={armed ? "true" : undefined}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
