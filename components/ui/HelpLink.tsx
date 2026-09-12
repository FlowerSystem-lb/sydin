import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import { cx } from "@/components/ui/utils";

/**
 * A quiet "What is this?" that opens the matching Help Center article.
 * Used sparingly: on the screens where a first-time user pauses (receiving,
 * payments), never as decoration.
 */
export default function HelpLink({
  article,
  children,
  className,
}: {
  /** The HelpArticle id in app/lib/helpContent.ts. */
  article: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/dashboard/help?article=${encodeURIComponent(article)}`}
      className={cx(
        "inline-flex items-center gap-1 text-xs font-semibold text-theme-accent underline-offset-2 hover:underline",
        className
      )}
    >
      <UiIcon name="info" className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}
