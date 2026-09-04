"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
} from "@/components/dashboard/Workspace";
import { Button, DialogShell, Select } from "@/components/ui";
import { supabase } from "@/app/lib/supabase";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
} from "@/app/lib/businessSettings";
import { formatInventoryPrice } from "@/app/lib/inventoryItemModel";
import {
  addSalesOrderPayment,
  deleteSalesOrder,
  deleteSalesOrderPayment,
  getIssueErrorMessage,
  getPaymentErrorMessage,
  getSalesOrderBalance,
  getSalesOrderPayments,
  getSalesOrder,
  getSalesOrderLineTotal,
  getSalesOrderTotal,
  issueSalesOrder,
  SALES_ORDER_PAYMENT_METHOD_LABELS,
  SALES_ORDER_PAYMENT_STATUS_LABELS,
  SALES_ORDER_STATUS_LABELS,
  type SalesOrder,
  type SalesOrderPayment,
  type SalesOrderPaymentMethod,
} from "@/app/lib/salesOrders";

/**
 * One invoice: what was sold, what it came to, and the button that makes it
 * real.
 *
 * Issuing is the only action in the sales module that changes stock, so it is
 * the only one that asks first -- and the dialog lists exactly which products
 * leave and how many, because "are you sure" without the numbers is not a
 * question anyone can answer.
 *
 * Every rule lives in the `issue_sales_order` database function rather than
 * here: draft only, ownership, enough stock, whole quantities, never twice for
 * the same line. This screen shows what the function says when it refuses,
 * word for word, because "Only 2 of Nivea blue in stock, but the invoice sells
 * 3" is the whole answer and "could not issue" is not.
 */
export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = Number(params?.id);

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [currencyCode, setCurrencyCode] = useState(
    DEFAULT_BUSINESS_SETTINGS.currency_code
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [notice, setNotice] = useState("");
  const [payments, setPayments] = useState<SalesOrderPayment[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<SalesOrderPaymentMethod>("cash");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!isActive) return;

        if (!user || !Number.isFinite(orderId)) {
          setError("We could not find that invoice.");
          return;
        }

        const [found, settings, paid] = await Promise.all([
          getSalesOrder(user.id, orderId),
          getOrCreateBusinessSettings(user.id),
          getSalesOrderPayments(orderId),
        ]);

        if (!isActive) return;

        setOrder(found);
        setPayments(paid);
        setCurrencyCode(
          settings?.currency_code || DEFAULT_BUSINESS_SETTINGS.currency_code
        );
      })
      .catch(() => {
        if (isActive) setError("We could not find that invoice.");
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [orderId]);

  const issue = async () => {
    if (!order || issuing) return;

    try {
      setIssuing(true);
      setError("");

      const issued = await issueSalesOrder(order.id);

      /* Keep the lines already on screen. The function returns the order row
         only, and re-reading everything would blank the invoice for a moment
         on a depot connection. */
      setOrder({ ...order, ...issued, lines: order.lines });
      setConfirmIssue(false);
      setNotice("Issued. The stock has left the depot.");
    } catch (issueError) {
      setConfirmIssue(false);
      setError(getIssueErrorMessage(issueError));
    } finally {
      setIssuing(false);
    }
  };

  /**
   * After any payment change the invoice row is re-read rather than patched
   * here. amount_paid, payment_status and the lifecycle status are all derived
   * by a database trigger from the whole log, so the database is the only thing
   * that knows the answer -- recomputing it in the browser would be a second
   * implementation of the same rule, free to disagree.
   */
  const refreshAfterPayment = async (userId: string) => {
    const [fresh, paid] = await Promise.all([
      getSalesOrder(userId, orderId),
      getSalesOrderPayments(orderId),
    ]);
    setOrder(fresh);
    setPayments(paid);
  };

  const recordPayment = async () => {
    if (!order || savingPayment) return;

    const amount = Number(paymentAmount);

    if (!(amount > 0)) {
      setPaymentError("Enter an amount above zero.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    try {
      setSavingPayment(true);
      setPaymentError("");
      await addSalesOrderPayment(order.id, { amount, method: paymentMethod });
      await refreshAfterPayment(user.id);
      setPaymentAmount("");
    } catch (error) {
      setPaymentError(getPaymentErrorMessage(error));
    } finally {
      setSavingPayment(false);
    }
  };

  const removePayment = async (paymentId: number) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    try {
      await deleteSalesOrderPayment(paymentId);
      await refreshAfterPayment(user.id);
    } catch (error) {
      setPaymentError(getPaymentErrorMessage(error));
    }
  };

  const removeDraft = async () => {
    if (!order || deleting) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    try {
      setDeleting(true);
      await deleteSalesOrder(user.id, order.id);
      router.push("/dashboard/sales");
    } catch {
      setError("We could not delete this draft. Please try again.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="operations-workspace">
        <DashboardPageShell>
          <p className="text-sm text-theme-muted">Loading...</p>
        </DashboardPageShell>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="operations-workspace">
        <DashboardPageShell>
          <DashboardNotice tone="danger">
            {error || "We could not find that invoice."}
          </DashboardNotice>
          <Link
            href="/dashboard/sales"
            className="mt-4 inline-flex text-sm font-semibold text-theme-accent"
          >
            Back to Sales
          </Link>
        </DashboardPageShell>
      </main>
    );
  }

  const total = getSalesOrderTotal(order);
  const balance = getSalesOrderBalance(order);
  const lines = order.lines || [];

  return (
    <main className="operations-workspace">
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Invoice"
          title={order.invoice_number}
          description={[
            order.customer_name_snapshot || "No customer named",
            order.issue_date || "No date",
            SALES_ORDER_STATUS_LABELS[order.status],
          ].join(" · ")}
          actions={
            order.status === "draft" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete draft
                </Button>
                <Button onClick={() => setConfirmIssue(true)}>
                  Issue invoice
                </Button>
              </div>
            ) : undefined
          }
        />

        {notice && <DashboardNotice tone="success">{notice}</DashboardNotice>}

        <div className="mt-4 grid gap-4">
          <section className="dashboard-card p-4">
            <h2 className="text-sm font-semibold text-theme-primary">
              What was sold
            </h2>

            <ul className="mt-3 grid gap-2">
              {lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3 border-b border-theme py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-theme-primary">
                      {line.name_snapshot}
                    </p>
                    <p className="truncate text-xs text-theme-muted">
                      {[
                        `${line.quantity}${
                          line.unit_label_snapshot
                            ? ` ${line.unit_label_snapshot}`
                            : ""
                        }`,
                        line.unit_price !== null
                          ? `at ${formatInventoryPrice(
                              line.unit_price,
                              currencyCode
                            )}`
                          : "no price",
                        line.line_type === "charge" ? "Charge" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-theme-primary tabular-nums">
                    {formatInventoryPrice(
                      getSalesOrderLineTotal(line),
                      currencyCode
                    ) || "--"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-theme pt-3">
              <span className="text-sm font-semibold text-theme-secondary">
                Total
              </span>
              <span className="text-xl font-semibold text-theme-primary tabular-nums">
                {formatInventoryPrice(total, currencyCode) || "--"}
              </span>
            </div>

            <p className="mt-2 text-xs text-theme-subtle">
              {SALES_ORDER_PAYMENT_STATUS_LABELS[order.payment_status]}
              {order.amount_paid
                ? ` · ${formatInventoryPrice(order.amount_paid, currencyCode)} received`
                : ""}
            </p>
          </section>

          {order.status !== "draft" && order.status !== "cancelled" && (
            <section className="dashboard-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-theme-primary">
                  Payments
                </h2>
                <p className="text-sm font-semibold text-theme-primary tabular-nums">
                  {formatInventoryPrice(balance, currencyCode) || "--"}
                  <span className="ml-1.5 text-xs font-normal text-theme-muted">
                    still owed
                  </span>
                </p>
              </div>

              {paymentError && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-theme-danger"
                >
                  {paymentError}
                </p>
              )}

              {payments.length > 0 && (
                <ul className="mt-3 grid gap-1.5">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-3 border-b border-theme py-2 text-sm last:border-b-0"
                    >
                      <span className="min-w-0 truncate text-theme-secondary">
                        {payment.paid_at}
                        {payment.method
                          ? ` · ${SALES_ORDER_PAYMENT_METHOD_LABELS[payment.method]}`
                          : ""}
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="font-semibold text-theme-primary tabular-nums">
                          {formatInventoryPrice(payment.amount, currencyCode)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void removePayment(payment.id)}
                          className="text-xs font-semibold text-theme-muted transition hover:text-theme-danger"
                        >
                          Remove
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {balance > 0 ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 text-xs font-semibold text-theme-secondary">
                    Amount received
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder={String(balance)}
                      className="sale-input w-40"
                    />
                  </label>
                  <div className="w-40">
                    <Select
                      label="How"
                      value={paymentMethod}
                      onChange={(value) =>
                        setPaymentMethod(value as SalesOrderPaymentMethod)
                      }
                      options={(
                        ["cash", "card", "transfer", "other"] as const
                      ).map((method) => ({
                        value: method,
                        label: SALES_ORDER_PAYMENT_METHOD_LABELS[method],
                      }))}
                    />
                  </div>
                  <Button
                    onClick={() => void recordPayment()}
                    loading={savingPayment}
                    loadingLabel="Saving..."
                  >
                    Record payment
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-xs font-semibold text-theme-success">
                  Settled in full.
                </p>
              )}
            </section>
          )}

          {order.notes && (
            <section className="dashboard-card p-4">
              <h2 className="text-sm font-semibold text-theme-primary">Notes</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-theme-secondary">
                {order.notes}
              </p>
            </section>
          )}

          {order.status === "draft" ? (
            <p className="rounded-xl border border-theme bg-theme-inset px-4 py-3 text-xs text-theme-muted">
              This is a draft. Nothing has left stock yet. Issuing takes every
              product line out of the depot and records it in Stock Movements.
            </p>
          ) : order.status === "issued" ? (
            <p className="rounded-xl border border-theme bg-theme-inset px-4 py-3 text-xs text-theme-muted">
              Issued{order.issued_at
                ? ` on ${new Date(order.issued_at).toLocaleDateString()}`
                : ""}
              . The stock has left the depot and each line is recorded in Stock
              Movements. An issued invoice cannot be edited or issued again.
            </p>
          ) : null}

          <Link
            href="/dashboard/sales"
            className="text-sm font-semibold text-theme-accent"
          >
            Back to Sales
          </Link>
        </div>
      </DashboardPageShell>

      {confirmIssue && (
        <DialogShell
          title={`Issue ${order.invoice_number}?`}
          eyebrow="This moves real stock"
          description="Every product line leaves the depot now and is written into Stock Movements. An issued invoice cannot be edited or undone."
          onClose={() => setConfirmIssue(false)}
          closeDisabled={issuing}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirmIssue(false)}
                disabled={issuing}
              >
                Not yet
              </Button>
              <Button
                onClick={() => void issue()}
                loading={issuing}
                loadingLabel="Issuing..."
              >
                Issue and take stock out
              </Button>
            </>
          }
        >
          <ul className="grid gap-1.5 text-sm text-theme-secondary">
            {lines
              .filter((line) => line.affects_stock)
              .map((line) => (
                <li key={line.id} className="flex justify-between gap-3">
                  <span className="truncate">{line.name_snapshot}</span>
                  <span className="shrink-0 font-semibold text-theme-primary tabular-nums">
                    -{line.quantity}
                    {line.unit_label_snapshot
                      ? ` ${line.unit_label_snapshot}`
                      : ""}
                  </span>
                </li>
              ))}
            {lines.every((line) => !line.affects_stock) && (
              <li className="text-theme-muted">
                No product lines, so no stock will move.
              </li>
            )}
          </ul>
        </DialogShell>
      )}

      {confirmDelete && (
        <DialogShell
          title={`Delete ${order.invoice_number}?`}
          eyebrow="Delete draft"
          description="The draft and its lines are removed. No stock has moved, so nothing else changes."
          tone="danger"
          onClose={() => setConfirmDelete(false)}
          closeDisabled={deleting}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Keep it
              </Button>
              <Button
                onClick={() => void removeDraft()}
                loading={deleting}
                loadingLabel="Deleting..."
              >
                Delete draft
              </Button>
            </>
          }
        />
      )}
    </main>
  );
}
