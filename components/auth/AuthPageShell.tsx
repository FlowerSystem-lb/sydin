import Link from "next/link";
import Image from "next/image";
import SydINLoginVisual from "@/components/auth/SydINLoginVisual";
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
              <Image
                src="/brand/sydin-logo.svg"
                alt=""
                width={150}
                height={46}
                priority
                className="login-brand-logo object-contain"
              />
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
