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
type RequestAction = "mark_paid" | "reject";
type ActivationTarget = "standard" | "pro";

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

interface PendingAction {
  action: RequestAction;
  request: PlanRequest;
}

interface ActivationPreview {
  request_id: string;
  customer_name: string;
  email: string;
  matched_user_id: string;
  selected_plan: string;
  target_plan: "Standard" | "Pro";
  item_limit: 250 | 1000;
  request_status: "pending" | "paid";
}

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
      <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
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

async function updatePlanRequest(
  requestId: string,
  action: RequestAction
): Promise<
  | {
      type: "success";
      message: string;
    }
  | {
      type: "denied";
    }
  | {
      type: "error";
      message: string;
    }
> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {
        type: "denied",
      };
    }

    const response = await fetch(
      `/api/admin/plan-requests/${encodeURIComponent(requestId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
        }),
      }
    );
    const payload = (await response.json()) as {
      message?: string;
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
        message: payload.error || "The plan request could not be updated.",
      };
    }

    return {
      type: "success",
      message: payload.message || "Plan request updated.",
    };
  } catch {
    return {
      type: "error",
      message: "The plan request is temporarily unavailable.",
    };
  }
}

async function requestPlanActivation(
  action: "preview" | "activate",
  requestId: string,
  targetPlan: ActivationTarget,
  matchedUserId?: string
): Promise<
  | {
      type: "preview";
      preview: ActivationPreview;
    }
  | {
      type: "success";
      message: string;
    }
  | {
      type: "denied";
    }
  | {
      type: "error";
      message: string;
    }
> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {
        type: "denied",
      };
    }

    const response = await fetch("/api/admin/activate-plan", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        request_id: requestId,
        target_plan: targetPlan,
        matched_user_id: matchedUserId,
      }),
    });
    const payload = (await response.json()) as {
      preview?: ActivationPreview;
      message?: string;
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
        message: payload.error || "The plan could not be activated.",
      };
    }

    if (action === "preview" && payload.preview) {
      return {
        type: "preview",
        preview: payload.preview,
      };
    }

    return {
      type: "success",
      message: payload.message || "Plan activated.",
    };
  } catch {
    return {
      type: "error",
      message: "Plan activation is temporarily unavailable.",
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
  const [notice, setNotice] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activationLookupKey, setActivationLookupKey] = useState("");
  const [activationPreview, setActivationPreview] =
    useState<ActivationPreview | null>(null);
  const [activationLoading, setActivationLoading] = useState(false);

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

  useEffect(() => {
    if (!pendingAction || actionLoading) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingAction(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionLoading, pendingAction]);

  useEffect(() => {
    if (!activationPreview || activationLoading) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivationPreview(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activationLoading, activationPreview]);

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

  const confirmAction = async () => {
    if (!pendingAction || actionLoading) return;

    setActionLoading(true);
    setError("");
    setNotice("");

    const result = await updatePlanRequest(
      pendingAction.request.id,
      pendingAction.action
    );

    if (result.type === "denied") {
      setAccessDenied(true);
      setRequests([]);
      setPendingAction(null);
      setActionLoading(false);
      return;
    }

    if (result.type === "error") {
      setError(result.message);
      setActionLoading(false);
      return;
    }

    const refreshed = await requestPlanRequests();

    if (refreshed.type === "success") {
      setRequests(refreshed.requests);
      setNotice(result.message);
      setPendingAction(null);
    } else if (refreshed.type === "denied") {
      setAccessDenied(true);
      setRequests([]);
      setPendingAction(null);
    } else {
      setError(
        `${result.message} Refresh the page to load the latest request status.`
      );
      setPendingAction(null);
    }

    setActionLoading(false);
  };

  const prepareActivation = async (
    planRequest: PlanRequest,
    targetPlan: ActivationTarget
  ) => {
    const lookupKey = `${planRequest.id}:${targetPlan}`;

    if (activationLookupKey || activationLoading) return;

    setActivationLookupKey(lookupKey);
    setError("");
    setNotice("");

    const result = await requestPlanActivation(
      "preview",
      planRequest.id,
      targetPlan
    );

    if (result.type === "denied") {
      setAccessDenied(true);
      setRequests([]);
    } else if (result.type === "error") {
      setError(result.message);
    } else if (result.type === "preview") {
      setActivationPreview(result.preview);
    }

    setActivationLookupKey("");
  };

  const confirmActivation = async () => {
    if (!activationPreview || activationLoading) return;

    setActivationLoading(true);
    setError("");
    setNotice("");

    const targetPlan = activationPreview.target_plan.toLowerCase() as
      | "standard"
      | "pro";
    const result = await requestPlanActivation(
      "activate",
      activationPreview.request_id,
      targetPlan,
      activationPreview.matched_user_id
    );

    if (result.type === "denied") {
      setAccessDenied(true);
      setRequests([]);
      setActivationPreview(null);
      setActivationLoading(false);
      return;
    }

    if (result.type === "error") {
      setError(result.message);
      setActivationLoading(false);
      return;
    }

    if (result.type !== "success") {
      setError("Activation confirmation returned an unexpected response.");
      setActivationLoading(false);
      return;
    }

    const refreshed = await requestPlanRequests();

    if (refreshed.type === "success") {
      setRequests(refreshed.requests);
      setNotice(result.message);
      setActivationPreview(null);
    } else if (refreshed.type === "denied") {
      setAccessDenied(true);
      setRequests([]);
      setActivationPreview(null);
    } else {
      setError(
        `${result.message} Refresh the page to load the latest request status.`
      );
      setActivationPreview(null);
    }

    setActivationLoading(false);
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
                    Manual review admin
                  </p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                    Plan requests
                  </h1>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Review early-access Standard and Pro requests, confirm manual
                payments, activate matched customer accounts, or reject
                requests.
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

        {notice && (
          <section className="rounded-3xl border border-emerald-300/25 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-100">
            {notice}
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
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
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

                {(request.status === "pending" ||
                  request.status === "paid") && (
                  <div className="mt-5 border-t border-white/10 pt-5">
                    <div
                      className={`rounded-2xl border p-4 ${
                        request.status === "paid"
                          ? "border-emerald-300/20 bg-emerald-500/[0.07]"
                          : "border-amber-300/20 bg-amber-500/[0.07]"
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-white">
                            Activate customer plan
                          </p>
                          <p
                            className={`mt-1 text-xs leading-5 ${
                              request.status === "paid"
                                ? "text-emerald-100/70"
                                : "text-amber-100/75"
                            }`}
                          >
                            {request.status === "paid"
                              ? "Payment is marked paid. Match the email to an existing SydIN account before activation."
                              : "Payment has not been marked paid. Activation will record payment confirmation automatically."}
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${
                            request.status === "paid"
                              ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                              : "border-amber-300/25 bg-amber-400/10 text-amber-100"
                          }`}
                        >
                          {request.status === "paid"
                            ? "Ready to activate"
                            : "Payment pending"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(["standard", "pro"] as ActivationTarget[]).map(
                          (targetPlan) => {
                            const label =
                              targetPlan === "standard" ? "Standard" : "Pro";
                            const lookupKey = `${request.id}:${targetPlan}`;
                            const isMatching =
                              activationLookupKey === lookupKey;
                            const isRequestedPlan =
                              request.selected_plan.trim().toLowerCase() ===
                              targetPlan;

                            return (
                              <button
                                key={targetPlan}
                                type="button"
                                onClick={() =>
                                  void prepareActivation(request, targetPlan)
                                }
                                disabled={
                                  Boolean(activationLookupKey) ||
                                  activationLoading ||
                                  actionLoading
                                }
                                className={`glass-button min-h-11 rounded-2xl px-4 py-3 text-sm ${
                                  isRequestedPlan
                                    ? "ring-2 ring-cyan-200/20"
                                    : ""
                                }`}
                              >
                                {isMatching
                                  ? "Matching account..."
                                  : `Activate ${label}`}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:justify-end">
                      {request.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setNotice("");
                          setPendingAction({
                            action: "mark_paid",
                            request,
                          });
                        }}
                        disabled={
                          actionLoading ||
                          activationLoading ||
                          Boolean(activationLookupKey)
                        }
                        className="glass-button min-h-11 rounded-2xl px-5 py-3 text-sm sm:min-w-32"
                      >
                        Mark Paid
                      </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setNotice("");
                          setPendingAction({
                            action: "reject",
                            request,
                          });
                        }}
                        disabled={
                          actionLoading ||
                          activationLoading ||
                          Boolean(activationLookupKey)
                        }
                        className="glass-button glass-button-danger min-h-11 rounded-2xl px-5 py-3 text-sm sm:min-w-32"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
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

      {pendingAction && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#020617]/88 p-4 backdrop-blur-xl"
          onClick={() => {
            if (!actionLoading) setPendingAction(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-action-title"
            className="glass-modal my-8 w-full max-w-lg p-5 sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-black uppercase tracking-[0.16em] ${
                    pendingAction.action === "reject"
                      ? "text-rose-300"
                      : "text-sky-300"
                  }`}
                >
                  Confirmation required
                </p>
                <h2
                  id="request-action-title"
                  className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl"
                >
                  {pendingAction.action === "mark_paid"
                    ? "Mark this request paid?"
                    : "Reject this plan request?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={actionLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-400 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close confirmation dialog"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-sm font-black text-white">
                {pendingAction.request.full_name}
              </p>
              <p className="mt-1 break-all text-sm text-slate-400">
                {pendingAction.request.email || "Email not available"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="glass-badge text-xs font-bold">
                  {pendingAction.request.selected_plan}
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${statusStyles[pendingAction.request.status]}`}
                >
                  {formatStatus(pendingAction.request.status)}
                </span>
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-300">
              {pendingAction.action === "mark_paid"
                ? "This records manual payment confirmation and reviewer details. It does not activate Standard or Pro."
                : "This marks the request as rejected and records reviewer details. The request will remain stored and no customer data will be deleted."}
            </p>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
                {error}
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={actionLoading}
                className="glass-button glass-button-secondary min-h-12 rounded-2xl px-5 py-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmAction()}
                disabled={actionLoading}
                className={`glass-button min-h-12 rounded-2xl px-5 py-3 text-sm ${
                  pendingAction.action === "reject"
                    ? "glass-button-danger"
                    : ""
                }`}
              >
                {actionLoading
                  ? pendingAction.action === "mark_paid"
                    ? "Marking paid..."
                    : "Rejecting..."
                  : pendingAction.action === "mark_paid"
                    ? "Confirm Mark Paid"
                    : "Confirm Reject"}
              </button>
            </div>
          </section>
        </div>
      )}

      {activationPreview && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#020617]/88 p-4 backdrop-blur-xl"
          onClick={() => {
            if (!activationLoading) setActivationPreview(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="activation-dialog-title"
            className="glass-modal my-8 w-full max-w-2xl p-5 sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                  Account matched
                </p>
                <h2
                  id="activation-dialog-title"
                  className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl"
                >
                  Confirm {activationPreview.target_plan} activation
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActivationPreview(null)}
                disabled={activationLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-400 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close activation dialog"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {activationPreview.request_status === "pending" && (
              <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold leading-6 text-amber-100">
                Payment has not been marked paid. Confirming activation will
                record payment confirmation now.
              </div>
            )}

            <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailRow
                label="Customer"
                value={activationPreview.customer_name}
              />
              <DetailRow label="Request email" value={activationPreview.email} />
              <DetailRow
                label="Matched user UUID"
                value={activationPreview.matched_user_id}
                mono
              />
              <DetailRow
                label="Current request status"
                value={formatStatus(activationPreview.request_status)}
              />
              <DetailRow
                label="Selected plan"
                value={activationPreview.selected_plan}
              />
              <DetailRow
                label="Target plan"
                value={activationPreview.target_plan}
              />
              <DetailRow
                label="Item limit"
                value={`${activationPreview.item_limit.toLocaleString()} items`}
              />
              <DetailRow
                label="Request ID"
                value={activationPreview.request_id}
                mono
              />
            </dl>

            <p className="mt-5 text-sm leading-7 text-slate-300">
              This activates the matched account without deleting or changing
              inventory, depots, settings, logos, QR links, or stock history.
            </p>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
                {error}
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setActivationPreview(null)}
                disabled={activationLoading}
                className="glass-button glass-button-secondary min-h-12 rounded-2xl px-5 py-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmActivation()}
                disabled={activationLoading}
                className="glass-button min-h-12 rounded-2xl border-emerald-200/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.32),rgba(14,165,233,0.45))] px-5 py-3 text-sm"
              >
                {activationLoading
                  ? `Activating ${activationPreview.target_plan}...`
                  : `Confirm ${activationPreview.target_plan} Activation`}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
