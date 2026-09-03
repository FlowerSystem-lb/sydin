"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import UiIcon from "@/components/UiIcon";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  FilterBar,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import { Button, DialogShell } from "@/components/ui";
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

        const [rows, plan] = await Promise.all([
          getCustomersForUser(user.id),
          getUserSubscription(user.id),
        ]);

        if (!isActive) return;

        setCustomers(rows);
        setSubscription(plan);
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
          <label className="flex min-h-11 w-full max-w-sm items-center gap-2 rounded-xl border border-theme bg-theme-surface px-3">
            <UiIcon name="search" className="h-4 w-4 text-theme-subtle" />
            <span className="sr-only">Search customers</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, contact, phone or email"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-theme-primary outline-none"
            />
          </label>
        </FilterBar>

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
          <div className="grid gap-3">
            {formError && (
              <p
                role="alert"
                className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger"
              >
                {formError}
              </p>
            )}

            <CustomerField
              label="Customer name"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <CustomerField
                label="Contact person"
                value={form.contact_name || ""}
                onChange={(value) => setForm({ ...form, contact_name: value })}
              />
              <CustomerField
                label="Phone"
                value={form.phone || ""}
                onChange={(value) => setForm({ ...form, phone: value })}
              />
              <CustomerField
                label="WhatsApp"
                value={form.whatsapp || ""}
                onChange={(value) => setForm({ ...form, whatsapp: value })}
              />
              <CustomerField
                label="Email"
                value={form.email || ""}
                onChange={(value) => setForm({ ...form, email: value })}
              />
            </div>
            <CustomerField
              label="Address"
              value={form.address || ""}
              onChange={(value) => setForm({ ...form, address: value })}
            />
            <CustomerField
              label="Notes"
              value={form.notes || ""}
              onChange={(value) => setForm({ ...form, notes: value })}
            />
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

function CustomerField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-theme-secondary">
      {label}
      {required && <span className="sr-only">(required)</span>}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-theme bg-theme-surface px-3 text-sm font-normal text-theme-primary outline-none focus:border-[#2563eb]/50 focus:ring-4 focus:ring-[#2563eb]/10"
      />
    </label>
  );
}
