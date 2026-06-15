import Link from "next/link";
import SydINLoginVisual from "@/components/auth/SydINLoginVisual";
import SydINMark from "@/components/brand/SydINMark";
import Wordmark from "@/components/Wordmark";
import UiIcon from "@/components/UiIcon";

export default function AuthPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="login-page">
      <section className="login-auth-panel">
        <div className="login-auth-inner">
          <header className="login-auth-header">
            <Link href="/" className="login-brand" aria-label="SydIN home">
              <SydINMark size="md" />
              <Wordmark size="md" variant="light-background" />
            </Link>

            <Link href="/" className="login-back-link">
              <UiIcon name="chevron-left" className="h-4 w-4" />
              Back to Home
            </Link>
          </header>

          {children}

          <footer className="login-legal">
            <Link href="/terms">Terms of Service</Link>
            <span aria-hidden="true">&bull;</span>
            <Link href="/privacy">Privacy Policy</Link>
          </footer>
        </div>
      </section>

      <SydINLoginVisual />
    </main>
  );
}
