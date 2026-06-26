"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import UiIcon from "@/components/UiIcon";
import {
  createSupplier,
  deleteSupplier,
  getSupplierErrorMessage,
  getSuppliersForUser,
  getWhatsAppHref,
  updateSupplier,
  type Supplier,
  type SupplierInput,
} from "@/app/lib/suppliers";
import { supabase } from "@/app/lib/supabase";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getSubscriptionSupplierLimit,
  getSubscriptionUsage,
  getUpgradePlanForSupplierLimit,
  type SubscriptionUsage,
} from "@/app/lib/subscription";

const EMPTY_FORM: SupplierInput = {
  name: "",
  contact_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  notes: "",
};

const DEFAULT_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

type SupplierFilter =
  | "all"
  | "with-contact"
  | "missing-contact"
  | "has-items"
  | "no-items";

const inputClassName =
  "w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-4 py-3.5 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-sky-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)] disabled:opacity-60";

function hasSupplierContact(supplier: Supplier) {
  return Boolean(
    supplier.contact_name?.trim() ||
      supplier.phone?.trim() ||
      supplier.whatsapp?.trim() ||
      supplier.email?.trim()
  );
}

function SupplierForm({
  title,
  eyebrow,
  values,
  error,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  title: string;
  eyebrow: string;
  values: SupplierInput;
  error: string;
  saving: boolean;
  onChange: (field: keyof SupplierInput, value: string) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const nameError = nameTouched && !values.name.trim();
  const emailError =
    emailTouched &&
    Boolean(values.email?.trim()) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email?.trim() || "");

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-theme-accent">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-black text-theme-primary">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          aria-label="Close supplier form"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-theme bg-theme-surface text-xl text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary"
        >
          ×
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Supplier name <span className="text-theme-accent">*</span>
          </label>
          <input
            autoFocus
            value={values.name}
            onBlur={() => setNameTouched(true)}
            onChange={(event) => onChange("name", event.target.value)}
            disabled={saving}
            aria-invalid={nameError}
            placeholder="e.g. Cedar Wholesale"
            className={`${inputClassName} ${
              nameError ? "border-red-400/50 bg-red-500/[0.08]" : ""
            }`}
          />
          {nameError && (
            <p className="mt-2 text-sm font-semibold text-theme-danger">
              Supplier name is required.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Contact name
          </label>
          <input
            value={values.contact_name || ""}
            onChange={(event) => onChange("contact_name", event.target.value)}
            disabled={saving}
            placeholder="Primary contact"
            className={inputClassName}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Email
          </label>
          <input
            type="email"
            value={values.email || ""}
            onBlur={() => setEmailTouched(true)}
            onChange={(event) => onChange("email", event.target.value)}
            disabled={saving}
            aria-invalid={emailError}
            placeholder="orders@example.com"
            className={`${inputClassName} ${
              emailError ? "border-red-400/50 bg-red-500/[0.08]" : ""
            }`}
          />
          {emailError && (
            <p className="mt-2 text-sm font-semibold text-theme-danger">
              Enter a valid email address.
            </p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Phone
          </label>
          <input
            type="tel"
            value={values.phone || ""}
            onChange={(event) => onChange("phone", event.target.value)}
            disabled={saving}
            placeholder="+961 ..."
            className={inputClassName}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            WhatsApp
          </label>
          <input
            type="tel"
            value={values.whatsapp || ""}
            onChange={(event) => onChange("whatsapp", event.target.value)}
            disabled={saving}
            placeholder="Include country code"
            className={inputClassName}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Address
          </label>
          <textarea
            value={values.address || ""}
            onChange={(event) => onChange("address", event.target.value)}
            disabled={saving}
            placeholder="Street, city, delivery details"
            className={`${inputClassName} min-h-24 resize-y`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-theme-secondary">
            Notes
          </label>
          <textarea
            value={values.notes || ""}
            onChange={(event) => onChange("notes", event.target.value)}
            disabled={saving}
            placeholder="Private purchasing or relationship notes"
            className={`${inputClassName} min-h-28 resize-y`}
          />
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-2xl border border-theme bg-theme-surface px-6 py-3.5 font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !values.name.trim() || emailError}
          className="rounded-2xl bg-white px-6 py-3.5 font-bold text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Supplier"}
        </button>
      </div>
    </form>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [usage, setUsage] = useState<SubscriptionUsage>(DEFAULT_USAGE);
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [formValues, setFormValues] = useState<SupplierInput>(EMPTY_FORM);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);

  const loadSuppliers = async (knownUserId?: string) => {
    const currentUserId =
      knownUserId || (await supabase.auth.getUser()).data.user?.id;

    if (!currentUserId) {
      setPageError("Please sign in again to manage suppliers.");
      setLoading(false);
      return;
    }

    setUserId(currentUserId);

    try {
      const [loadedSuppliers, loadedUsage] = await Promise.all([
        getSuppliersForUser(currentUserId),
        getSubscriptionUsage(currentUserId),
      ]);
      setSuppliers(loadedSuppliers);
      setUsage(loadedUsage);
    } catch (error) {
      setPageError(getSupplierErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setPageError("Please sign in again to manage suppliers.");
          setLoading(false);
          return;
        }

        setUserId(user.id);

        Promise.all([
          getSuppliersForUser(user.id),
          getSubscriptionUsage(user.id),
        ])
          .then(([loadedSuppliers, loadedUsage]) => {
            if (!isActive) return;
            setSuppliers(loadedSuppliers);
            setUsage(loadedUsage);
            setLoading(false);
          })
          .catch((error) => {
            if (!isActive) return;
            setPageError(getSupplierErrorMessage(error));
            setLoading(false);
          });
      })
      .catch(() => {
        if (!isActive) return;
        setPageError("We could not confirm your session. Please sign in again.");
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const supplierLimit = getSubscriptionSupplierLimit(usage.subscription);
  const limitReached = suppliers.length >= supplierLimit;
  const currentPlanName = formatPlanName(usage.subscription.plan);
  const requiredPlan = getUpgradePlanForSupplierLimit(usage.subscription.plan);

  const visibleSuppliers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          supplier.name,
          supplier.contact_name,
          supplier.phone,
          supplier.whatsapp,
          supplier.email,
          supplier.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const hasContact = hasSupplierContact(supplier);
      const itemCount = supplier.item_count || 0;
      const matchesFilter =
        supplierFilter === "all" ||
        (supplierFilter === "with-contact" && hasContact) ||
        (supplierFilter === "missing-contact" && !hasContact) ||
        (supplierFilter === "has-items" && itemCount > 0) ||
        (supplierFilter === "no-items" && itemCount === 0);

      return matchesSearch && matchesFilter;
    });
  }, [search, supplierFilter, suppliers]);

  const supplierFilters: {
    value: SupplierFilter;
    label: string;
    count: number;
  }[] = [
    { value: "all", label: "All", count: suppliers.length },
    {
      value: "with-contact",
      label: "With contact",
      count: suppliers.filter(hasSupplierContact).length,
    },
    {
      value: "missing-contact",
      label: "Missing contact",
      count: suppliers.filter((supplier) => !hasSupplierContact(supplier))
        .length,
    },
    {
      value: "has-items",
      label: "Has items",
      count: suppliers.filter((supplier) => (supplier.item_count || 0) > 0)
        .length,
    },
    {
      value: "no-items",
      label: "No items",
      count: suppliers.filter((supplier) => (supplier.item_count || 0) === 0)
        .length,
    },
  ];

  const openCreateForm = () => {
    setEditingSupplier(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const openEditForm = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormValues({
      name: supplier.name,
      contact_name: supplier.contact_name || "",
      phone: supplier.phone || "",
      whatsapp: supplier.whatsapp || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const resetForm = () => {
    setFormOpen(false);
    setEditingSupplier(null);
    setFormValues(EMPTY_FORM);
    setFormError("");
  };

  const closeForm = () => {
    if (saving) return;
    resetForm();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !formValues.name.trim()) return;

    try {
      setSaving(true);
      setFormError("");
      setPageError("");
      setPageNotice("");

      if (!userId) {
        setFormError("Please sign in again before saving this supplier.");
        return;
      }

      if (!editingSupplier) {
        const [freshSuppliers, freshUsage] = await Promise.all([
          getSuppliersForUser(userId),
          getSubscriptionUsage(userId),
        ]);
        const freshLimit = getSubscriptionSupplierLimit(freshUsage.subscription);

        setSuppliers(freshSuppliers);
        setUsage(freshUsage);

        if (freshSuppliers.length >= freshLimit) {
          setFormError(
            `You reached the ${formatPlanName(
              freshUsage.subscription.plan
            )} plan limit of ${freshLimit} suppliers.`
          );
          return;
        }

        await createSupplier(userId, formValues);
        setPageNotice("Supplier added successfully.");
      } else {
        await updateSupplier(userId, editingSupplier.id, formValues);
        setPageNotice("Supplier updated successfully.");
      }

      resetForm();
      await loadSuppliers(userId);
    } catch (error) {
      setFormError(getSupplierErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || deletingId || !userId) return;

    try {
      setDeletingId(pendingDelete.id);
      setPageError("");
      await deleteSupplier(userId, pendingDelete.id);
      setPendingDelete(null);
      setPageNotice("Supplier deleted. Assigned items now show No supplier.");
      await loadSuppliers(userId);
    } catch {
      setPageError("We could not delete this supplier. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="contents">
      <main className="organize-workspace organize-suppliers">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-7">
          <section className="glass-panel p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  Purchasing contacts
                </p>
                <h1 className="mt-2 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                  Suppliers
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-theme-muted sm:text-lg">
                  Keep vendor contacts organized and connect them to inventory when useful.
                </p>
              </div>
              <div className="organize-page-actions flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard/inventory"
                  className="organize-inventory-link rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 text-center font-bold text-theme-primary transition hover:bg-theme-hover"
                >
                  Inventory
                </Link>
                <button
                  type="button"
                  onClick={openCreateForm}
                  disabled={loading || limitReached}
                  className="glass-button px-5 py-3.5 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add Supplier
                </button>
              </div>
            </div>
          </section>

          {(pageError || pageNotice) && (
            <div
              role={pageError ? "alert" : "status"}
              className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
                pageError
                  ? "border-red-400/25 bg-red-500/10 text-theme-danger"
                  : "border-emerald-400/25 bg-emerald-500/10 text-theme-success"
              }`}
            >
              {pageError || pageNotice}
            </div>
          )}

          {!loading && limitReached && (
            <LockedFeaturePanel
              feature={`${currentPlanName} supplier limit reached`}
              benefit={`${currentPlanName} includes up to ${supplierLimit} suppliers. Existing suppliers remain available and editable.`}
              currentPlan={currentPlanName}
              requiredPlan={requiredPlan}
              source="supplier-limit"
              compact
            />
          )}

          <section className="organize-search-card glass-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-semibold text-theme-muted">
                  Search suppliers
                </label>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search suppliers"
                  className={inputClassName}
                />
              </div>
              <p className="rounded-2xl border border-theme bg-theme-inset px-4 py-3 text-sm font-bold text-theme-secondary">
                {suppliers.length} / {supplierLimit} suppliers
              </p>
            </div>
            <div
              className="organize-chip-strip mt-4"
              role="group"
              aria-label="Supplier filters"
            >
              {supplierFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={supplierFilter === filter.value}
                  onClick={() => setSupplierFilter(filter.value)}
                  className={`organize-chip ${
                    supplierFilter === filter.value ? "organize-chip-active" : ""
                  }`}
                >
                  <span>{filter.label}</span>
                  <span>{filter.count}</span>
                </button>
              ))}
            </div>
          </section>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((key) => (
                <div key={key} className="glass-card h-72 animate-pulse" />
              ))}
            </div>
          ) : visibleSuppliers.length > 0 ? (
            <div className="organize-list-grid grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleSuppliers.map((supplier) => {
                const whatsappHref = supplier.whatsapp
                  ? getWhatsAppHref(supplier.whatsapp)
                  : "";

                return (
                  <article
                    key={supplier.id}
                    className="organize-row organize-supplier-row glass-card flex flex-col p-5 sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="break-words text-2xl font-black text-theme-primary">
                          {supplier.name}
                        </h2>
                        <p className="mt-2 text-sm font-semibold text-theme-accent">
                          {supplier.contact_name || "No contact name"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-sky-300/20 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-theme-accent">
                        {supplier.item_count || 0} items
                      </span>
                    </div>

                    <div className="organize-row-meta mt-5 flex flex-wrap gap-2">
                      {supplier.phone && (
                        <span className="rounded-full border border-theme bg-theme-surface px-3 py-1.5 text-xs font-semibold text-theme-secondary">
                          {supplier.phone}
                        </span>
                      )}
                      {supplier.whatsapp && (
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-theme-success">
                          WhatsApp {supplier.whatsapp}
                        </span>
                      )}
                      {supplier.email && (
                        <span className="max-w-full break-all rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100">
                          {supplier.email}
                        </span>
                      )}
                    </div>

                    {(supplier.address || supplier.notes) && (
                      <div className="mt-5 space-y-2 rounded-2xl border border-theme bg-theme-inset p-4 text-sm leading-6 text-theme-muted">
                        {supplier.address && <p>{supplier.address}</p>}
                        {supplier.notes && (
                          <p className="whitespace-pre-wrap">{supplier.notes}</p>
                        )}
                      </div>
                    )}

                    <div className="organize-row-actions mt-auto pt-6">
                      <div className="grid grid-cols-3 gap-2">
                        <a
                          href={supplier.phone ? `tel:${supplier.phone}` : undefined}
                          aria-disabled={!supplier.phone}
                          className={`rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition ${
                            supplier.phone
                              ? "border-theme bg-theme-surface text-theme-primary hover:bg-theme-hover"
                              : "pointer-events-none border-white/5 bg-white/[0.02] text-theme-subtle"
                          }`}
                        >
                          Call
                        </a>
                        <a
                          href={whatsappHref || undefined}
                          target={whatsappHref ? "_blank" : undefined}
                          rel={whatsappHref ? "noreferrer" : undefined}
                          aria-disabled={!whatsappHref}
                          className={`rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition ${
                            whatsappHref
                              ? "border-emerald-300/20 bg-emerald-500/10 text-theme-success hover:bg-emerald-500/20"
                              : "pointer-events-none border-white/5 bg-white/[0.02] text-theme-subtle"
                          }`}
                        >
                          WhatsApp
                        </a>
                        <a
                          href={supplier.email ? `mailto:${supplier.email}` : undefined}
                          aria-disabled={!supplier.email}
                          className={`rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition ${
                            supplier.email
                              ? "border-violet-300/20 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                              : "pointer-events-none border-white/5 bg-white/[0.02] text-theme-subtle"
                          }`}
                        >
                          Email
                        </a>
                      </div>

                      <div className="organize-desktop-actions mt-3 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => openEditForm(supplier)}
                          className="rounded-2xl bg-white px-4 py-3 font-bold text-black transition hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(supplier)}
                          className="rounded-2xl border border-red-400/25 bg-red-500/15 px-4 py-3 font-bold text-theme-danger transition hover:bg-red-500/25"
                        >
                          Delete
                        </button>
                      </div>
                      <details className="organize-action-menu organize-mobile-actions mt-2">
                        <summary aria-label={`More actions for ${supplier.name}`}>
                          <UiIcon name="more" className="h-4 w-4" />
                        </summary>
                        <div>
                          <button
                            type="button"
                            onClick={() => openEditForm(supplier)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(supplier)}
                            className="organize-danger-action"
                          >
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="glass-card border-dashed px-5 py-16 text-center">
              <h2 className="text-3xl font-black text-theme-primary">
                {suppliers.length === 0 ? "Add your first supplier" : "No suppliers found"}
              </h2>
              <p className="mx-auto mt-3 max-w-md leading-7 text-theme-muted">
                {suppliers.length === 0
                  ? "Supplier links are optional. Your existing items can stay without a supplier."
                  : "Try a different name, contact, phone number, email, or note."}
              </p>
              {suppliers.length === 0 && !limitReached && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="glass-button mt-6 px-6 py-3.5 font-bold"
                >
                  Add your first supplier
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {formOpen && (
        <div className="organize-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="glass-modal my-6 max-h-[calc(100vh-2rem)] w-full overflow-y-auto p-5 sm:p-7">
            <SupplierForm
              title={editingSupplier ? "Edit Supplier" : "Add Supplier"}
              eyebrow={editingSupplier ? "Supplier details" : "New supplier"}
              values={formValues}
              error={formError}
              saving={saving}
              onChange={(field, value) =>
                setFormValues((current) => ({ ...current, [field]: value }))
              }
              onCancel={closeForm}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="organize-modal-overlay fixed inset-0 z-[60] flex items-center justify-center theme-overlay p-4 backdrop-blur-xl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-supplier-title"
            className="glass-modal w-full max-w-md p-6 sm:p-7"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">
              Delete supplier
            </p>
            <h2 id="delete-supplier-title" className="mt-3 text-2xl font-black text-theme-primary">
              Delete {pendingDelete.name}?
            </h2>
            <p className="mt-3 leading-7 text-theme-muted">
              Inventory items will not be deleted. They will become No supplier.
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId !== null}
                className="flex-1 rounded-2xl border border-theme bg-theme-surface px-5 py-3.5 font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deletingId !== null}
                className="flex-1 rounded-2xl border border-red-400/25 bg-red-500/20 px-5 py-3.5 font-bold text-theme-danger transition hover:bg-red-500/30 disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Delete Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
