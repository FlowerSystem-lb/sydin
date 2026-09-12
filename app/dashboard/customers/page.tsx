"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  FilterBar,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import {
  Badge,
  Button,
  DialogShell,
  FieldGroup,
  FieldRow,
  ResultsAnnouncer,
  SearchInput,
  SheetShell,
  buttonClassName,
} from "@/components/ui";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
} from "@/app/lib/businessSettings";
import { formatInventoryPrice } from "@/app/lib/inventoryItemModel";
import {
  SALES_ORDER_STATUS_LABELS,
  getSalesOrderBalance,
  getSalesOrderTotal,
  getSalesOrdersForUser,
  type SalesOrder,
} from "@/app/lib/salesOrders";
import { supabase } from "@/app/lib/supabase";
import {
  createCustomer,
  deleteCustomer,
  getCustomerErrorMessage,
  getCustomersForUser,
  updateCustomer,
  type Customer,
  type CustomerInput,
} from "@/app/lib/customers";
import { getWhatsAppHref } from "@/app/lib/suppliers";
import {
  FALLBACK_SUBSCRIPTION,
  getSubscriptionCustomerLimit,
  getUserSubscription,
  type UserSubscription,
} from "@/app/lib/subscription";

/**
 * Who the depot sells to.
 *
 * Step 1 of the sales module, and deliberately the same screen as Suppliers
 * with the direction reversed: a named party, contact details, one per name.
 * Suppliers has been in production for months, so this reuses its shape, its
 * WhatsApp helper and its plan-limit pattern rather than inventing a second way
 * to keep a contact.
 *
 * What it does NOT show yet is what each customer has bought. That needs sales,
 * which is the next step. An empty "0 orders" column would be a promise the app
 * cannot keep today.
 */

const EMPTY_FORM: CustomerInput = {
  name: "",
  contact_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  notes: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  // Every invoice, once, so each customer's balance and history come from
  // the same list the Sales page shows -- no second source of truth.
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [currencyCode, setCurrencyCode] = useState(
    DEFAULT_BUSINESS_SETTINGS.currency_code || "USD"
  );
  const [accountCustomer, setAccountCustomer] = useState<Customer | null>(null);
  const [subscription, setSubscription] =
    useState<UserSubscription>(FALLBACK_SUBSCRIPTION);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Invoices by customer, with the two numbers a row needs: how many, and
     what is still owed. Drafts and cancelled invoices are not money. */
  const accounts = useMemo(() => {
    const map = new Map<
      number,
      { orders: SalesOrder[]; owed: number; billed: number; overdue: number }
    >();
    const today = new Date().toISOString().slice(0, 10);
    for (const order of salesOrders) {
      if (order.customer_id === null || order.customer_id === undefined) continue;
      const entry = map.get(order.customer_id) || {
        orders: [],
        owed: 0,
        billed: 0,
        overdue: 0,
      };
      entry.orders.push(order);
      if (order.status !== "draft" && order.status !== "cancelled") {
        entry.billed += getSalesOrderTotal(order);
        const remaining = getSalesOrderBalance(order);
        entry.owed += remaining;
        if (remaining > 0 && order.due_date && order.due_date < today) entry.overdue += 1;
      }
      map.set(order.customer_id, entry);
    }
    return map;
  }, [salesOrders]);

  /** Used after a save or a delete, from an event handler. */
  const reload = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    try {
      const [rows, plan] = await Promise.all([
        getCustomersForUser(user.id),
        getUserSubscription(user.id),
      ]);
      setCustomers(rows);
      setSubscription(plan);
      setPageError("");
    } catch (error) {
      setPageError(getCustomerErrorMessage(error));
    }
  }, []);

  /**
   * The first load is written as a promise chain rather than an awaited call,
   * matching every other dashboard page. React 19's lint rule rejects a
   * setState reached directly from an effect body; inside a `.then` it is fine,
   * and the `isActive` guard is what stops a slow response writing to a screen
   * that has already been navigated away from.
   */
  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setPageError("Please sign in again to view your customers.");
          return;
        }

        const [rows, plan, orders, settings] = await Promise.all([
          getCustomersForUser(user.id),
          getUserSubscription(user.id),
          getSalesOrdersForUser(user.id).catch(() => [] as SalesOrder[]),
          getOrCreateBusinessSettings(user.id).catch(() => DEFAULT_BUSINESS_SETTINGS),
        ]);

        if (!isActive) return;

        setCustomers(rows);
        setSubscription(plan);
        setSalesOrders(orders);
        setCurrencyCode(settings.currency_code || "USD");
      })
      .catch((error) => {
        if (isActive) setPageError(getCustomerErrorMessage(error));
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const customerLimit = getSubscriptionCustomerLimit(subscription);
  const limitReached = customers.length >= customerLimit;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;

    return customers.filter((customer) =>
      [
        customer.name,
        customer.contact_name,
        customer.phone,
        customer.whatsapp,
        customer.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [customers, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      name: customer.name,
      contact_name: customer.contact_name || "",
      phone: customer.phone || "",
      whatsapp: customer.whatsapp || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const save = async () => {
    if (saving) return;

    if (!form.name.trim()) {
      setFormError("Give this customer a name.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFormError("Your session expired. Sign in again and retry.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      if (editing) {
        await updateCustomer(user.id, editing.id, form);
        setNotice(`${form.name.trim()} updated.`);
      } else {
        await createCustomer(user.id, form);
        setNotice(`${form.name.trim()} added.`);
      }

      setFormOpen(false);
      await reload();
    } catch (error) {
      setFormError(getCustomerErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    try {
      setDeleting(true);
      await deleteCustomer(user.id, pendingDelete.id);
      setNotice(`${pendingDelete.name} removed.`);
      setPendingDelete(null);
      await reload();
    } catch (error) {
      setPageError(getCustomerErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="operations-workspace">
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Selling contacts"
          title="Customers"
          description="The shops and buyers you sell to. Kept here so an invoice can name one instead of retyping it every time."
          actions={
            <ActionButton
              icon="plus"
              onClick={openCreate}
              disabled={limitReached}
            >
              Add customer
            </ActionButton>
          }
        />

        {pageError && <DashboardNotice tone="danger">{pageError}</DashboardNotice>}
        {notice && <DashboardNotice tone="success">{notice}</DashboardNotice>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-xl border border-theme bg-theme-inset px-3 py-1.5 text-xs font-semibold text-theme-secondary">
            {customers.length} / {customerLimit} customers
          </span>
          {limitReached && (
            <span className="text-xs font-semibold text-theme-warning">
              Your plan is full. Remove one, or upgrade to add more.
            </span>
          )}
        </div>

        <FilterBar label="Customer search" className="mt-4">
          {/* Was hand-rolled: a bordered <label> wrapping a bare input, with
              `min-h-11` meaning to be 44px and landing on 37px against this
              app's 13.6px root. The shared control carries its own height,
              focus ring and clear button. */}
          <SearchInput
            label="Search customers"
            value={search}
            onChange={setSearch}
            placeholder="Search name, contact, phone or email"
            className="w-full max-w-sm"
          />
        </FilterBar>
        <ResultsAnnouncer count={visible.length} noun="customer" />

        {loading ? (
          <LoadingSkeletonGroup count={3} />
        ) : visible.length === 0 ? (
          <DashboardEmptyState
            icon="suppliers"
            title={
              customers.length === 0
                ? "No customers yet"
                : "No customer matches that search"
            }
            description={
              customers.length === 0
                ? "Add the shops you sell to. Once they are here, an invoice can name one in a tap."
                : "Try a different name, phone number or email."
            }
            action={
              customers.length === 0 ? (
                <ActionButton icon="plus" onClick={openCreate}>
                  Add customer
                </ActionButton>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-4 grid gap-2">
            {visible.map((customer) => (
              <article
                key={customer.id}
                className="dashboard-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-theme-primary">
                    {customer.name}
                  </h2>
                  <p className="mt-1 truncate text-xs text-theme-muted">
                    {[
                      customer.contact_name,
                      customer.phone,
                      customer.email,
                      customer.address,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No contact details yet"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const account = accounts.get(customer.id);
                    if (!account || account.orders.length === 0) return null;
                    return account.owed > 0 ? (
                      <Badge tone={account.overdue > 0 ? "danger" : "warning"}>
                        Owes {formatInventoryPrice(account.owed, currencyCode)}
                      </Badge>
                    ) : (
                      <Badge tone="success">Settled</Badge>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => setAccountCustomer(customer)}
                    className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-primary transition hover:bg-theme-hover"
                  >
                    Account
                  </button>
                  {customer.phone && (
                    <a
                      href={`tel:${customer.phone}`}
                      className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-primary transition hover:bg-theme-hover"
                    >
                      Call
                    </a>
                  )}
                  {customer.whatsapp && getWhatsAppHref(customer.whatsapp) && (
                    <a
                      href={getWhatsAppHref(customer.whatsapp)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-primary transition hover:bg-theme-hover"
                    >
                      WhatsApp
                    </a>
                  )}
                  {customer.email && (
                    <a
                      href={`mailto:${customer.email}`}
                      className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-primary transition hover:bg-theme-hover"
                    >
                      Email
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(customer)}
                    className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 py-2 text-xs font-semibold text-theme-primary transition hover:bg-theme-hover"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(customer)}
                    className="min-h-11 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-theme-danger transition hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </DashboardPageShell>

      {accountCustomer && (() => {
        const account = accounts.get(accountCustomer.id) || {
          orders: [],
          owed: 0,
          billed: 0,
          overdue: 0,
        };
        const orders = [...account.orders].sort((a, b) =>
          (b.issue_date || b.created_at).localeCompare(a.issue_date || a.created_at)
        );
        return (
          <SheetShell
            title={accountCustomer.name}
            eyebrow="Customer account"
            description={
              [accountCustomer.contact_name, accountCustomer.phone, accountCustomer.email]
                .filter(Boolean)
                .join(" · ") || undefined
            }
            onClose={() => setAccountCustomer(null)}
            footer={
              <>
                <Button variant="secondary" onClick={() => setAccountCustomer(null)}>
                  Close
                </Button>
                <Link
                  href={`/dashboard/sales/new?customer=${accountCustomer.id}`}
                  className={buttonClassName()}
                >
                  New invoice
                </Link>
              </>
            }
          >
            <div className="grid gap-4">
              {/* The three numbers a customer conversation turns on. */}
              {account.orders.length > 0 && (
              <div className="po-balance-strip">
                <div>
                  <small>Invoiced</small>
                  <strong>{formatInventoryPrice(account.billed, currencyCode) || "—"}</strong>
                </div>
                <div>
                  <small>Paid</small>
                  <strong>
                    {formatInventoryPrice(
                      Math.max(0, account.billed - account.owed),
                      currencyCode
                    ) || "—"}
                  </strong>
                </div>
                <div
                  className={
                    account.owed > 0 ? "po-balance-remaining-due" : "po-balance-remaining-clear"
                  }
                >
                  <small>{account.owed > 0 ? "Still owes" : "Settled"}</small>
                  <strong>
                    {account.owed > 0
                      ? formatInventoryPrice(account.owed, currencyCode)
                      : "✓"}
                  </strong>
                </div>
              </div>
              )}

              {accountCustomer.address && (
                <div>
                  <p className="po-detail-label">Address</p>
                  <p className="whitespace-pre-line text-sm text-theme-secondary">
                    {accountCustomer.address}
                  </p>
                </div>
              )}

              <div className="grid gap-1.5">
                <p className="po-detail-label">Invoices</p>
                {orders.length === 0 ? (
                  <p className="text-sm text-theme-muted">
                    Nothing invoiced to this customer yet.
                  </p>
                ) : (
                  orders.map((order) => {
                    const remaining = getSalesOrderBalance(order);
                    const money = order.status !== "draft" && order.status !== "cancelled";
                    return (
                      <Link
                        key={order.id}
                        href={`/dashboard/sales/${order.id}`}
                        className="po-detail-line"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-theme-primary">
                            {order.invoice_number}
                            {order.title ? ` — ${order.title}` : ""}
                          </span>
                          <span className="block truncate text-xs font-semibold text-theme-muted">
                            {[
                              order.issue_date || order.created_at.slice(0, 10),
                              SALES_ORDER_STATUS_LABELS[order.status],
                              money && remaining > 0
                                ? `${formatInventoryPrice(remaining, currencyCode)} still owed`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-black text-theme-primary">
                          {formatInventoryPrice(getSalesOrderTotal(order), currencyCode) || "—"}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>

              {accountCustomer.notes && (
                <div>
                  <p className="po-detail-label">Notes</p>
                  <p className="text-sm text-theme-secondary">{accountCustomer.notes}</p>
                </div>
              )}
            </div>
          </SheetShell>
        );
      })()}

      {formOpen && (
        <DialogShell
          title={editing ? "Edit customer" : "Add customer"}
          eyebrow={editing ? "Customer details" : "New customer"}
          onClose={() => setFormOpen(false)}
          closeDisabled={saving}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void save()}
                loading={saving}
                loadingLabel="Saving..."
              >
                {editing ? "Save changes" : "Add customer"}
              </Button>
            </>
          }
        >
          <div className="item-form -mx-1">
            {formError && (
              <p
                role="alert"
                className="mx-5 mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger"
              >
                {formError}
              </p>
            )}

            {/* Same label/value rows as Add Item and the invoice. Was a stack
                of boxed inputs with the label above each -- a third shape for
                the same job. */}
            <FieldGroup>
              <FieldRow label="Name" htmlFor="customer-name" required>
                <input
                  id="customer-name"
                  placeholder="Business or person"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </FieldRow>

              <FieldRow label="Contact" htmlFor="customer-contact">
                <input
                  id="customer-contact"
                  placeholder="Who you deal with"
                  value={form.contact_name || ""}
                  onChange={(event) =>
                    setForm({ ...form, contact_name: event.target.value })
                  }
                />
              </FieldRow>
            </FieldGroup>

            <FieldGroup label="Reach them">
              <FieldRow label="Phone" htmlFor="customer-phone">
                <input
                  id="customer-phone"
                  placeholder="Phone number"
                  value={form.phone || ""}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
              </FieldRow>

              <FieldRow label="WhatsApp" htmlFor="customer-whatsapp">
                <input
                  id="customer-whatsapp"
                  placeholder="WhatsApp number"
                  value={form.whatsapp || ""}
                  onChange={(event) =>
                    setForm({ ...form, whatsapp: event.target.value })
                  }
                />
              </FieldRow>

              <FieldRow label="Email" htmlFor="customer-email">
                <input
                  id="customer-email"
                  type="email"
                  placeholder="name@example.com"
                  value={form.email || ""}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </FieldRow>

              <FieldRow label="Address" htmlFor="customer-address">
                <input
                  id="customer-address"
                  placeholder="Street, city"
                  value={form.address || ""}
                  onChange={(event) =>
                    setForm({ ...form, address: event.target.value })
                  }
                />
              </FieldRow>
            </FieldGroup>

            <FieldGroup label="Notes">
              <textarea
                value={form.notes || ""}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                placeholder="Anything worth remembering about this customer"
                className="item-panel-textarea"
              />
            </FieldGroup>
          </div>
        </DialogShell>
      )}

      {pendingDelete && (
        <DialogShell
          title={`Delete ${pendingDelete.name}?`}
          eyebrow="Delete customer"
          description="Their contact details are removed. Nothing else in the app is changed."
          tone="danger"
          onClose={() => setPendingDelete(null)}
          closeDisabled={deleting}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void confirmDelete()}
                loading={deleting}
                loadingLabel="Deleting..."
              >
                Delete customer
              </Button>
            </>
          }
        />
      )}
    </main>
  );
}

