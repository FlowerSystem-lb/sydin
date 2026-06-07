"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Wordmark from "@/components/Wordmark";
import UiIcon from "@/components/UiIcon";
import { supabase } from "@/app/lib/supabase";

type RequestStatus = "pending" | "paid" | "activated" | "rejected";
type StatusFilter = "all" | RequestStatus;
type PlanFilter = "all" | "standard" | "pro";

interface PlanRequest {
  id: string;
  full_name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  selected_plan: string;
  message: string | null;
  created_at: string | null;
  status: RequestStatus;
  user_id: string | null;
  paid_at: string | null;
  activated_at: string | null;
  reviewed_at: string | null;
}

type LoadResult =
  | {
      type: "success";
      requests: PlanRequest[];
    }
  | {
      type: "denied";
    }
  | {
      type: "error";
      message: string;
    };

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "activated", label: "Activated" },
  { value: "rejected", label: "Rejected" },
];

const planFilters: { value: PlanFilter; label: string }[] = [
  { value: "all", label: "All plans" },
  { value: "standard", label: "Standard" },
  { value: "pro", label: "Pro" },
];

const statusStyles: Record<RequestStatus, string> = {
  pending: "border-amber-300/25 bg-amber-500/10 text-amber-100",
  paid: "border-sky-300/25 bg-sky-500/10 text-sky-100",
  activated: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
  rejected: "border-rose-300/25 bg-rose-500/10 text-rose-100",
};

function formatStatus(status: RequestStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-4">
      <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-2 break-words text-sm font-semibold leading-6 text-slate-200 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value || "Not available"}
      </dd>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

async function requestPlanRequests(): Promise<LoadResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {
        type: "denied",
      };
    }

    const response = await fetch("/api/admin/plan-requests", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      requests?: PlanRequest[];
      error?: string;
    };

    if (response.status === 401 || response.status === 403) {
      return {
        type: "denied",
      };
    }

    if (!response.ok) {
      return {
        type: "error",
        message: payload.error || "Plan requests could not be loaded.",
      };
    }

    return {
      type: "success",
      requests: payload.requests || [],
    };
  } catch {
    return {
      type: "error",
      message: "Plan requests are temporarily unavailable.",
    };
  }
}

export default function AdminPlanRequestsPage() {
  const [requests, setRequests] = useState<PlanRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    requestPlanRequests().then((result) => {
      if (!isActive) return;

      if (result.type === "denied") {
        setAccessDenied(true);
        setRequests([]);
        setLoading(false);
        return;
      }

      if (result.type === "error") {
        setError(result.message);
        setLoading(false);
        return;
      }

      setError("");
      setAccessDenied(false);
      setRequests(result.requests);
      setLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const refreshRequests = async () => {
    if (refreshing) return;

    setRefreshing(true);
    setError("");

    const result = await requestPlanRequests();

    if (result.type === "denied") {
      setAccessDenied(true);
      setRequests([]);
    } else if (result.type === "error") {
      setError(result.message);
    } else {
      setAccessDenied(false);
      setRequests(result.requests);
    }

    setRefreshing(false);
  };

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return requests.filter((request) => {
      const statusMatches =
        statusFilter === "all" || request.status === statusFilter;
      const requestPlan = request.selected_plan.trim().toLowerCase();
      const planMatches =
        planFilter === "all" || requestPlan === planFilter;
      const searchMatches =
        !normalizedSearch ||
        [
          request.email,
          request.full_name,
          request.business_name || "",
        ].some((value) => value.toLowerCase().includes(normalizedSearch));

      return statusMatches && planMatches && searchMatches;
    });
  }, [planFilter, requests, search, statusFilter]);

  const statusCounts = useMemo(
    () =>
      requests.reduce<Record<RequestStatus, number>>(
        (counts, request) => {
          counts[request.status] += 1;
          return counts;
        },
        {
          pending: 0,
          paid: 0,
          activated: 0,
          rejected: 0,
        }
      ),
    [requests]
  );

  if (loading) {
    return (
      <main className="liquid-bg min-h-screen overflow-x-hidden px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="glass-panel h-40 animate-pulse" />
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="glass-card h-80 animate-pulse"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="liquid-bg flex min-h-screen items-center justify-center overflow-x-hidden px-4 py-10 text-white sm:px-6">
        <section className="glass-panel w-full max-w-xl p-6 text-center sm:p-9">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-sky-200/20 bg-sky-400/10 text-sky-100">
            <ShieldIcon />
          </div>
          <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-sky-300">
            Private SydIN workspace
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Admin access required
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-400 sm:text-base">
            This account is not authorized to view plan requests. Sign in with
            the SydIN admin account or return to your dashboard.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="glass-button min-h-12 rounded-2xl px-5 py-3 text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="glass-button glass-button-secondary min-h-12 rounded-2xl px-5 py-3 text-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="liquid-bg min-h-screen overflow-x-hidden px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-9">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="glass-panel overflow-hidden p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-3"
                aria-label="SydIN home"
              >
                <BrandMark compact />
                <Wordmark size="md" />
              </Link>
              <div className="mt-7 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/20 bg-sky-400/10 text-sky-100">
                  <ShieldIcon />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">
                    Read-only admin
                  </p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                    Plan requests
                  </h1>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Review early-access Standard and Pro requests. This page does
                not activate plans or change payment status.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="glass-button glass-button-secondary min-h-12 rounded-2xl px-5 py-3 text-sm"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void refreshRequests()}
                disabled={refreshing}
                className="glass-button min-h-12 rounded-2xl px-5 py-3 text-sm"
              >
                <UiIcon name="download" className="h-4 w-4 rotate-180" />
                {refreshing ? "Refreshing..." : "Refresh requests"}
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="glass-card col-span-2 p-4 sm:p-5 lg:col-span-1">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Total
            </p>
            <p className="mt-2 text-3xl font-black">{requests.length}</p>
          </div>
          {(
            [
              "pending",
              "paid",
              "activated",
              "rejected",
            ] as RequestStatus[]
          ).map((status) => (
            <div key={status} className="glass-card p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                {formatStatus(status)}
              </p>
              <p className="mt-2 text-3xl font-black">
                {statusCounts[status]}
              </p>
            </div>
          ))}
        </section>

        <section className="glass-panel p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_220px]">
            <label className="relative block">
              <span className="sr-only">
                Search by email, full name, or business name
              </span>
              <UiIcon
                name="search"
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search email, full name, or business..."
                className="glass-input min-h-12 pl-12"
              />
            </label>

            <label>
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="glass-input min-h-12"
              >
                {statusFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Filter by plan</span>
              <select
                value={planFilter}
                onChange={(event) =>
                  setPlanFilter(event.target.value as PlanFilter)
                }
                className="glass-input min-h-12"
              >
                {planFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Showing {filteredRequests.length} of {requests.length} requests
          </p>
        </section>

        {error && (
          <section className="rounded-3xl border border-rose-300/25 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-100">
            {error}
          </section>
        )}

        {filteredRequests.length > 0 ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredRequests.map((request) => (
              <article
                key={request.id}
                className="glass-card min-w-0 overflow-hidden p-5 sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">
                      {request.business_name || "Individual request"}
                    </p>
                    <h2 className="mt-2 break-words text-2xl font-black tracking-tight text-white">
                      {request.full_name}
                    </h2>
                    <p className="mt-2 break-all text-sm font-semibold text-slate-400">
                      {request.email || "Email not available"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${statusStyles[request.status]}`}
                    >
                      {formatStatus(request.status)}
                    </span>
                    <span className="glass-badge text-xs font-black">
                      {request.selected_plan}
                    </span>
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailRow label="Phone / WhatsApp" value={request.phone} />
                  <DetailRow
                    label="Requested"
                    value={formatDate(request.created_at)}
                  />
                  <DetailRow
                    label="User ID"
                    value={request.user_id}
                    mono
                  />
                  <DetailRow
                    label="Request ID"
                    value={request.id}
                    mono
                  />
                </dl>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Message
                  </p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
                    {request.message || "No message was included."}
                  </p>
                </div>

                <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <DetailRow
                    label="Paid at"
                    value={
                      request.paid_at ? formatDate(request.paid_at) : null
                    }
                  />
                  <DetailRow
                    label="Activated at"
                    value={
                      request.activated_at
                        ? formatDate(request.activated_at)
                        : null
                    }
                  />
                  <DetailRow
                    label="Reviewed at"
                    value={
                      request.reviewed_at
                        ? formatDate(request.reviewed_at)
                        : null
                    }
                  />
                </dl>
              </article>
            ))}
          </section>
        ) : (
          <section className="glass-panel px-5 py-14 text-center sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-sky-200/20 bg-sky-400/10 text-sky-100">
              <UiIcon name="search" className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-black">
              No matching plan requests
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-400">
              Adjust the search or filters. New requests will appear here after
              customers submit the early-access form.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
