"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import Wordmark from "@/components/Wordmark";
import {
  getOrCreateBusinessSettings,
} from "@/app/lib/businessSettings";
import {
  formatPlanName,
  getSubscriptionUsage,
} from "@/app/lib/subscription";
import { supabase } from "@/app/lib/supabase";

interface SidebarProps {
  onAddItem?: () => void;
  addItemHref?: string;
  planName?: string;
  itemUsage?: string;
  businessName?: string;
  businessLogoUrl?: string;
}

type ShellIconName =
  | "dashboard"
  | "inventory"
  | "add"
  | "depots"
  | "settings";

function ShellIcon({
  name,
  className = "h-5 w-5",
}: {
  name: ShellIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "dashboard" && (
        <>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </>
      )}
      {name === "inventory" && (
        <>
          <path d="m3.5 7.5 8.5 4.8 8.5-4.8" />
          <path d="M12 22V12.3" />
          <path d="m7.5 4.8 9 5.1" />
          <path d="M4.8 5.6 11 2.1a2 2 0 0 1 2 0l6.2 3.5a2 2 0 0 1 1 1.7v9.4a2 2 0 0 1-1 1.7L13 21.9a2 2 0 0 1-2 0l-6.2-3.5a2 2 0 0 1-1-1.7V7.3a2 2 0 0 1 1-1.7Z" />
        </>
      )}
      {name === "add" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </>
      )}
      {name === "depots" && (
        <>
          <path d="M3 21V8l9-5 9 5v13" />
          <path d="M7 21v-8h10v8M7 9h.01M11 9h.01M15 9h.01" />
          <path d="M10 17h4" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
        </>
      )}
    </svg>
  );
}

export default function Sidebar({
  onAddItem,
  addItemHref,
  planName,
  itemUsage,
  businessName,
  businessLogoUrl,
}: SidebarProps) {
  const pathname = usePathname();
  const [loadedPlanName, setLoadedPlanName] = useState("");
  const [loadedItemUsage, setLoadedItemUsage] = useState("");
  const [loadedBusinessName, setLoadedBusinessName] = useState("");
  const [loadedBusinessLogoUrl, setLoadedBusinessLogoUrl] = useState("");

  useEffect(() => {
    if (planName && itemUsage && businessName) return;

    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!isActive || !user) return;

        Promise.all([
          planName && itemUsage
            ? Promise.resolve(null)
            : getSubscriptionUsage(user.id),
          businessName
            ? Promise.resolve(null)
            : getOrCreateBusinessSettings(user.id),
        ])
          .then(([usage, settings]) => {
            if (!isActive) return;

            if (usage) {
              setLoadedPlanName(formatPlanName(usage.subscription.plan));
              setLoadedItemUsage(
                `${usage.usedItems} / ${usage.subscription.item_limit} items`
              );
            }

            if (settings) {
              setLoadedBusinessName(settings.business_name);
              setLoadedBusinessLogoUrl(settings.business_logo_url);
            }
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [businessLogoUrl, businessName, itemUsage, planName]);

  const displayPlanName = planName || loadedPlanName;
  const displayItemUsage = itemUsage || loadedItemUsage;
  const displayBusinessName =
    businessName || loadedBusinessName || "SydIn Account";
  const displayBusinessLogoUrl = businessLogoUrl || loadedBusinessLogoUrl;
  const displayInitials = displayBusinessName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "SI";
  const usageMatch = displayItemUsage.match(
    /([\d,]+)\s*\/\s*([\d,]+)/
  );
  const usedItems = usageMatch
    ? Number(usageMatch[1].replaceAll(",", ""))
    : 0;
  const itemLimit = usageMatch
    ? Number(usageMatch[2].replaceAll(",", ""))
    : 0;
  const usagePercent =
    itemLimit > 0
      ? Math.min(100, Math.round((usedItems / itemLimit) * 100))
      : 0;

  const links = [
    {
      name: "Dashboard",
      mobileName: "Home",
      href: "/dashboard",
      icon: "dashboard" as const,
    },
    {
      name: "Inventory",
      mobileName: "Inventory",
      href: "/dashboard/inventory",
      icon: "inventory" as const,
    },
    {
      name: "Add Item",
      mobileName: "Add Item",
      href: "/dashboard/add-item",
      icon: "add" as const,
    },
    {
      name: "Depots",
      mobileName: "Depots",
      href: "/dashboard/depots",
      icon: "depots" as const,
    },
    {
      name: "Settings",
      mobileName: "Settings",
      href: "/dashboard/settings",
      icon: "settings" as const,
    },
  ];

  const addActionClass =
    "glass-button min-h-11 w-full rounded-lg px-4 py-3 text-sm";

  const renderAddAction = (compact = false) => {
    const content = compact ? (
      <ShellIcon name="add" className="h-5 w-5" />
    ) : (
      <>
        <ShellIcon name="add" className="h-5 w-5" />
        Quick add
      </>
    );
    const className = compact
      ? "glass-button h-10 w-10 shrink-0 rounded-lg p-0"
      : addActionClass;

    if (onAddItem) {
      return (
        <button
          type="button"
          onClick={onAddItem}
          className={className}
          aria-label={compact ? "Quick add item" : undefined}
          title={compact ? "Quick add item" : undefined}
        >
          {content}
        </button>
      );
    }

    if (addItemHref) {
      return (
        <Link
          href={addItemHref}
          className={className}
          aria-label={compact ? "Add item" : undefined}
          title={compact ? "Add item" : undefined}
        >
          {content}
        </Link>
      );
    }

    return null;
  };

  return (
    <>
      <aside className="glass-sidebar fixed inset-y-0 left-0 z-40 hidden w-[280px] overflow-y-auto overflow-x-hidden p-4 text-white lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent"
        />

        <div className="relative flex min-h-full flex-col">
          <Link
            href="/dashboard"
            className="group flex items-center gap-3 rounded-lg border border-sky-200/10 bg-white/[0.035] p-3 transition hover:border-sky-200/20 hover:bg-white/[0.055]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-cyan-200/25 bg-gradient-to-br from-sky-400/25 to-blue-600/25 text-xs font-black text-sky-100 shadow-[0_12px_34px_rgba(14,165,233,0.14)]">
              IN
            </div>

            <div className="min-w-0">
              <Wordmark />

              <p className="truncate text-xs font-medium text-slate-400">
                Inventory operations
              </p>
            </div>
          </Link>

          <div className="mb-2 mt-7 px-3">
            <p className="text-xs font-bold uppercase text-slate-500">
              Workspace
            </p>
          </div>

          <nav className="flex flex-col gap-1.5">
            {links.map((link) => {
              const active =
                link.href === "/dashboard"
                  ? pathname === link.href
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex min-h-12 items-center gap-3 overflow-hidden rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "border-sky-300/25 bg-gradient-to-r from-sky-400/20 to-blue-500/15 text-white shadow-[0_10px_30px_rgba(14,116,229,0.12)]"
                      : "border-transparent text-slate-400 hover:border-sky-200/10 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                      active
                        ? "bg-sky-300/15 text-cyan-100"
                        : "bg-white/[0.035] text-slate-500 group-hover:bg-white/[0.07] group-hover:text-slate-200"
                    }`}
                  >
                    <ShellIcon name={link.icon} className="h-[18px] w-[18px]" />
                  </span>

                  {link.name}

                  {active && (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-cyan-300" />
                  )}
                </Link>
              );
            })}
          </nav>

          {(onAddItem || addItemHref) && (
            <div className="mt-5 grid px-1">
              {renderAddAction()}
            </div>
          )}

          <div className="glass-card mt-auto rounded-lg border-sky-200/15 bg-[#071a3a]/68 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-sky-300">
                  Workspace
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Private account
                </p>
              </div>

              <LogoutButton variant="icon" />
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-sky-200/10 pt-4">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sky-200/20 bg-gradient-to-br from-sky-400/20 to-blue-600/20 text-sm font-black text-sky-100">
                {displayBusinessLogoUrl ? (
                  <Image
                    src={displayBusinessLogoUrl}
                    alt={displayBusinessName}
                    fill
                    sizes="44px"
                    className="bg-white object-contain p-1.5"
                  />
                ) : (
                  displayInitials
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  {displayBusinessName}
                </p>

                <p className="mt-1 inline-flex rounded-full border border-sky-200/15 bg-sky-400/10 px-2 py-0.5 text-xs font-semibold text-sky-200">
                  {displayPlanName
                    ? `${displayPlanName} plan`
                    : "Premium workspace"}
                </p>
              </div>
            </div>

            {displayItemUsage && (
              <div className="mt-4 rounded-lg border border-sky-200/10 bg-[#020b20]/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-400">
                    Item usage
                  </p>

                  <p className="text-xs font-bold text-white">
                    {displayItemUsage}
                  </p>
                </div>

                {usageMatch && (
                  <div
                    className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
                    role="progressbar"
                    aria-label="Inventory item usage"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={usagePercent}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500"
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <header className="glass-nav sticky top-0 z-40 px-3 py-3 text-white sm:px-4 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2.5"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sky-200/20 bg-gradient-to-br from-sky-400/20 to-blue-600/20 text-xs font-black text-sky-100">
              {displayBusinessLogoUrl ? (
                <Image
                  src={displayBusinessLogoUrl}
                  alt={displayBusinessName}
                  fill
                  sizes="40px"
                  className="object-contain p-1"
                />
              ) : (
                displayInitials
              )}
            </div>

            <div className="min-w-0">
              <Wordmark size="sm" />

              <p className="hidden max-w-48 truncate text-xs text-slate-400 sm:block">
                {displayBusinessName}
              </p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            {renderAddAction(true)}
            <LogoutButton variant="icon" />
          </div>
        </div>

        <nav className="mt-3 grid grid-cols-5 gap-1.5 border-t border-sky-200/10 pt-3 sm:gap-2">
          {links.map((link) => {
            const active =
              link.href === "/dashboard"
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center text-xs font-semibold leading-tight transition ${
                  active
                    ? "border-sky-300/25 bg-sky-400/15 text-white"
                    : "border-transparent bg-white/[0.035] text-slate-400"
                }`}
              >
                <ShellIcon
                  name={link.icon}
                  className={`h-5 w-5 ${
                    active ? "text-cyan-200" : "text-slate-500"
                  }`}
                />
                <span className="max-w-full truncate">{link.mobileName}</span>
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
