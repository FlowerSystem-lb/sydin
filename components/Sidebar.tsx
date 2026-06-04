"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  onAddItem?: () => void;
  addItemHref?: string;
}

export default function Sidebar({
  onAddItem,
  addItemHref,
}: SidebarProps) {
  const pathname = usePathname();

  const links = [
    {
      name: "Dashboard",
      href: "/dashboard",
      marker: "D",
    },
    {
      name: "Inventory",
      href: "/dashboard/inventory",
      marker: "I",
    },
  ];

  const addActionClass =
    "rounded-2xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(79,70,229,0.18)] transition hover:border-indigo-300/50 hover:bg-indigo-500/25";

  const renderAddAction = () => {
    if (onAddItem) {
      return (
        <button
          type="button"
          onClick={onAddItem}
          className={addActionClass}
        >
          Add Item
        </button>
      );
    }

    if (addItemHref) {
      return (
        <Link
          href={addItemHref}
          className={addActionClass}
        >
          Add Item
        </Link>
      );
    }

    return null;
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] border-r border-white/10 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_34%),linear-gradient(180deg,_rgba(5,7,19,0.96),_rgba(2,3,10,0.92))] p-5 text-white shadow-[24px_0_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl lg:flex lg:flex-col">
        <div className="relative flex min-h-full flex-col">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 text-lg font-black shadow-[0_20px_60px_rgba(124,58,237,0.35)]">
              S
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                SydIn
              </h1>

              <p className="text-sm text-slate-400">
                Inventory SaaS
              </p>
            </div>
          </Link>

          <nav className="mt-8 flex flex-col gap-2">
            {links.map((link) => {
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-white text-black shadow-[0_20px_60px_rgba(255,255,255,0.12)]"
                      : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black transition ${
                      active
                        ? "bg-black text-white"
                        : "bg-white/[0.06] text-slate-400 group-hover:bg-white/10 group-hover:text-white"
                    }`}
                  >
                    {link.marker}
                  </span>

                  {link.name}
                </Link>
              );
            })}
          </nav>

          {(onAddItem || addItemHref) && (
            <div className="mt-6 grid">
              {renderAddAction()}
            </div>
          )}

          <div className="mt-auto rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Workspace
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-500" />

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  SydIn Account
                </p>

                <p className="text-xs text-slate-500">
                  Premium workspace
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050713]/85 px-4 py-3 text-white backdrop-blur-2xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 text-sm font-black">
              S
            </div>

            <div>
              <p className="text-lg font-bold">
                SydIn
              </p>

              <p className="text-xs text-slate-400">
                Inventory SaaS
              </p>
            </div>
          </Link>

          {renderAddAction()}
        </div>

        <nav className="mt-3 grid grid-cols-2 gap-2">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                  active
                    ? "bg-white text-black"
                    : "bg-white/[0.06] text-slate-300"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
