"use client";

import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import { cx } from "@/components/ui/utils";

export default function ContextBackButton({
  fallbackHref,
  label,
  className,
}: {
  fallbackHref: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();

  const navigateBack = () => {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo");
    const isSafeReturn =
      returnTo?.startsWith("/dashboard") && !returnTo.startsWith("//");

    if (isSafeReturn && returnTo) {
      router.push(returnTo);
      return;
    }

    const referrer = document.referrer;
    if (referrer) {
      try {
        const url = new URL(referrer);
        if (
          url.origin === window.location.origin &&
          url.pathname.startsWith("/dashboard")
        ) {
          router.back();
          return;
        }
      } catch {
        // Use the logical parent below.
      }
    }

    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={navigateBack}
      className={cx(
        "inline-flex min-h-10 items-center gap-2 rounded-xl border border-theme bg-theme-surface px-3.5 py-2 text-sm font-bold text-theme-secondary transition hover:bg-theme-hover hover:text-theme-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/20",
        className
      )}
    >
      <UiIcon name="chevron-left" className="h-4 w-4" />
      {label}
    </button>
  );
}
