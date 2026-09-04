"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import {
  DashboardPageHeader,
  DashboardPageShell,
} from "@/components/dashboard/Workspace";
import { supabase } from "@/app/lib/supabase";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionCapabilities,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";

/**
 * One page for the things you DO to stock, rather than five entries competing
 * for room in the sidebar.
 *
 * The sidebar had nineteen links across seven groups, and five of them were the
 * same kind of thing: a process with steps that ends in a quantity changing.
 * Grouping those behind one door leaves the sidebar for places you go and this
 * page for jobs you run.
 *
 * Locked cards stay visible on purpose. A workflow that vanishes on the Free
 * plan cannot be discovered, so nobody upgrades for it -- and it also makes the
 * app look emptier than it is. The padlock says "this exists, it is not yours
 * yet", which is the honest version.
 */

interface Workflow {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: UiIconName;
  /** Null when the workflow is on every plan. */
  capability: "purchaseOrders" | "sales" | "receiving" | null;
  note?: string;
}

const WORKFLOWS: Workflow[] = [
  {
    key: "sales",
    label: "Sales",
    description:
      "Raise an invoice, put products on it with prices, and issue it. Issuing takes the goods out of the depot and records every line.",
    href: "/dashboard/sales",
    icon: "file",
    capability: "sales",
  },
  {
    key: "purchase-orders",
    label: "Purchase Orders",
    description:
      "Order from a supplier, track what has been paid and what is still owed, then book the delivery in against the order.",
    href: "/dashboard/purchase-orders",
    icon: "file",
    capability: "purchaseOrders",
  },
  {
    key: "receiving",
    label: "Stock In",
    description:
      "Book arriving stock into a depot when there is no purchase behind it — customer returns, corrections and quick restocks.",
    href: "/dashboard/receiving",
    icon: "download",
    capability: "receiving",
  },
  {
    key: "pick-lists",
    label: "Pick Lists",
    description:
      "Gather items for a customer, tick them off as they are picked, and take them out of stock when the list is completed.",
    href: "/dashboard/pick-lists",
    icon: "picklists",
    capability: null,
  },
  {
    key: "stock-counts",
    label: "Stock Counts",
    description:
      "Count a shelf against what SydIN thinks is there, review only the differences, and finalise them into auditable adjustments.",
    href: "/dashboard/stock-counts",
    icon: "layers",
    capability: null,
  },
];

export default function WorkflowsPage() {
  const [subscription, setSubscription] =
    useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!isActive || !user) return;

        const plan = await getUserSubscription(user.id);
        if (isActive) setSubscription(plan);
      })
      .catch(() => {
        /* The list still renders; a plan we could not read simply shows
           everything unlocked rather than locking someone out of what they
           are paying for. */
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const capabilities = getSubscriptionCapabilities(subscription);

  return (
    <main className="operations-workspace">
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Workflows"
          title="Workflows"
          description="The jobs you run against your stock. Each one ends with a quantity changing, and records why."
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {WORKFLOWS.map((workflow) => {
            const locked =
              !loading &&
              workflow.capability !== null &&
              !capabilities[workflow.capability];

            return (
              <WorkflowCard
                key={workflow.key}
                workflow={workflow}
                locked={locked}
                planName={formatPlanName(subscription.plan)}
              />
            );
          })}
        </div>
      </DashboardPageShell>
    </main>
  );
}

function WorkflowCard({
  workflow,
  locked,
  planName,
}: {
  workflow: Workflow;
  locked: boolean;
  planName: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-theme bg-theme-inset text-theme-accent">
          <UiIcon name={workflow.icon} className="h-4 w-4" />
        </span>
        {locked && (
          <span className="flex items-center gap-1.5 rounded-full border border-theme bg-theme-inset px-2.5 py-1 text-xs font-semibold text-theme-muted">
            <UiIcon name="alert" className="h-3.5 w-3.5" />
            {planName} plan
          </span>
        )}
      </div>

      <h2 className="mt-3 text-sm font-semibold text-theme-primary">
        {workflow.label}
      </h2>
      <p className="mt-1.5 text-xs leading-5 text-theme-muted">
        {workflow.description}
      </p>

      <span
        className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${
          locked ? "text-theme-muted" : "text-theme-accent"
        }`}
      >
        {locked ? "See plans" : `Open ${workflow.label}`}
        <UiIcon name="chevron-right" className="h-3.5 w-3.5" />
      </span>
    </>
  );

  return (
    <Link
      href={locked ? "/pricing" : workflow.href}
      className={`dashboard-card flex flex-col p-4 transition hover:bg-theme-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/20 ${
        locked ? "opacity-70" : ""
      }`}
    >
      {body}
    </Link>
  );
}
