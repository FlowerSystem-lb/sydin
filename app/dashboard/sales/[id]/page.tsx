"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
} from "@/components/dashboard/Workspace";
import { Button, DialogShell } from "@/components/ui";
import { supabase } from "@/app/lib/supabase";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
} from "@/app/lib/businessSettings";
import { formatInventoryPrice } from "@/app/lib/inventoryItemModel";
import {
  deleteSalesOrder,
  getIssueErrorMessage,
  getSalesOrder,
  getSalesOrderLineTotal,
  getSalesOrderTotal,
  issueSalesOrder,
  SALES_ORDER_PAYMENT_STATUS_LABELS,
  SALES_ORDER_STATUS_LABELS,
  type SalesOrder,
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

        const [found, settings] = await Promise.all([
          getSalesOrder(user.id, orderId),
          getOrCreateBusinessSettings(user.id),
        ]);

        if (!isActive) return;

        setOrder(found);
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
