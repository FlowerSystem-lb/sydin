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
    {
      name: "Add Item",
      href: "/dashboard/add-item",
      marker: "+",
    },
    {
      name: "Depots",
      href: "/dashboard/depots",
      marker: "L",
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      marker: "S",
    },
  ];

  const addActionClass =
    "inline-flex min-h-11 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-3 text-sm font-bold text-white shadow-[0_18px_50px_rgba(79,70,229,0.18)] transition hover:border-indigo-300/50 hover:bg-indigo-500/25";

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
      <aside className="glass-sidebar fixed inset-y-0 left-0 z-40 hidden w-[280px] p-5 text-white lg:flex lg:flex-col">
        <div className="relative flex min-h-full flex-col">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.065]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-500/15 text-sm font-black text-indigo-100 shadow-[0_20px_60px_rgba(79,70,229,0.22)]">
              IN
            </div>

            <div>
              <Wordmark />

              <p className="text-sm text-slate-400">
                Inventory SaaS
              </p>
            </div>
          </Link>

          <nav className="mt-8 flex flex-col gap-2">
            {links.map((link) => {
              const active =
                link.href === "/dashboard"
                  ? pathname === link.href
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);

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

          <div className="mt-auto rounded-3xl border border-white/10 bg-white/[0.045] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.2)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Workspace
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Signed-in account
                </p>
              </div>

              <LogoutButton variant="compact" />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-indigo-300/20 bg-indigo-500/15 text-sm font-black text-indigo-100">
                {displayBusinessLogoUrl ? (
                  <Image
                    src={displayBusinessLogoUrl}
                    alt={displayBusinessName}
                    fill
                    sizes="48px"
                    className="bg-white object-contain p-1.5"
                  />
                ) : (
                  displayInitials
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {displayBusinessName}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {displayPlanName
                    ? `${displayPlanName} plan`
                    : "Premium workspace"}
                </p>
              </div>
            </div>

            {displayItemUsage && (
              <div className="mt-4 rounded-2xl border border-indigo-300/20 bg-indigo-500/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200">
                    Usage
                  </p>

                  <p className="text-sm font-black text-white">
                  {displayItemUsage}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <header className="glass-nav sticky top-0 z-40 px-4 py-3 text-white lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-indigo-300/20 bg-indigo-500/15 text-xs font-black text-indigo-100">
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

            <div>
              <Wordmark size="sm" />

              <p className="text-xs text-slate-400">
                {displayBusinessName}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {renderAddAction()}
            <LogoutButton variant="icon" />
          </div>
        </div>

        <nav className="mt-3 grid grid-cols-5 gap-2">
          {links.map((link) => {
            const active =
              link.href === "/dashboard"
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`min-h-11 rounded-2xl px-2 py-3 text-center text-xs font-bold transition sm:px-4 sm:text-sm ${
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
