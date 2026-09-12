"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LockedFeaturePanel } from "@/components/UpgradePrompt";
import UiIcon from "@/components/UiIcon";
import {
  ActionButton,
  DashboardEmptyState,
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
  DashboardToolbar,
  FilterBar,
  FilterChip,
  LoadingSkeletonGroup,
} from "@/components/dashboard/Workspace";
import {
  Badge,
  Button,
  buttonClassName,
  DialogShell,
  FieldGroup,
  FieldRow,
  ResultsAnnouncer,
  SheetShell,
} from "@/components/ui";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
} from "@/app/lib/businessSettings";
import { formatInventoryPrice } from "@/app/lib/inventoryItemModel";
import {
  PURCHASE_ORDER_STATUS_LABELS,
  getPurchaseOrderBalance,
  getPurchaseOrderReceivingProgress,
  getPurchaseOrderTotal,
  getPurchaseOrdersForUser,
  isPurchaseOrderOpen,
  type PurchaseOrder,
} from "@/app/lib/purchaseOrders";
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
  "w-full rounded-2xl border border-theme bg-[var(--sydin-input-bg)] px-4 py-3.5 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-sydin-blue/50 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] disabled:opacity-60";

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
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-theme bg-theme-surface text-xl text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary"
        >
          ×
        </button>
      </div>

      {/* The same label/value rows Add Item, the invoice and Customers use.
          Was two columns of boxed inputs with the label stacked above each --
          Customers, its own mirror image, did it a third way again. */}
      <div className="item-form -mx-1 mt-4">
        <FieldGroup>
          <FieldRow
            label="Name"
            htmlFor="supplier-name-input"
            required
            error={nameError ? "Supplier name is required." : undefined}
            errorId="supplier-name-error"
          >
            <input
              id="supplier-name-input"
              autoFocus
              value={values.name}
              onBlur={() => setNameTouched(true)}
              onChange={(event) => onChange("name", event.target.value)}
              disabled={saving}
              aria-invalid={nameError}
              aria-describedby={nameError ? "supplier-name-error" : undefined}
              placeholder="e.g. Cedar Wholesale"
            />
          </FieldRow>

          <FieldRow label="Contact" htmlFor="supplier-contact-input">
            <input
              id="supplier-contact-input"
              value={values.contact_name || ""}
              onChange={(event) => onChange("contact_name", event.target.value)}
              disabled={saving}
              placeholder="Who you deal with"
            />
          </FieldRow>
        </FieldGroup>

        <FieldGroup label="Reach them">
          <FieldRow
            label="Email"
            htmlFor="supplier-email-input"
            error={emailError ? "Enter a valid email address." : undefined}
            errorId="supplier-email-error"
          >
            <input
              id="supplier-email-input"
              type="email"
              value={values.email || ""}
              onBlur={() => setEmailTouched(true)}
              onChange={(event) => onChange("email", event.target.value)}
              disabled={saving}
              aria-invalid={emailError}
              aria-describedby={emailError ? "supplier-email-error" : undefined}
              placeholder="orders@example.com"
            />
          </FieldRow>

          <FieldRow label="Phone" htmlFor="supplier-phone-input">
            <input
              id="supplier-phone-input"
              type="tel"
              value={values.phone || ""}
              onChange={(event) => onChange("phone", event.target.value)}
              disabled={saving}
              placeholder="Phone number"
            />
          </FieldRow>

          <FieldRow label="WhatsApp" htmlFor="supplier-whatsapp-input">
            <input
              id="supplier-whatsapp-input"
              type="tel"
              value={values.whatsapp || ""}
              onChange={(event) => onChange("whatsapp", event.target.value)}
              disabled={saving}
              placeholder="Include country code"
            />
          </FieldRow>

          <FieldRow label="Address" htmlFor="supplier-address-input">
            <input
              id="supplier-address-input"
              value={values.address || ""}
              onChange={(event) => onChange("address", event.target.value)}
              disabled={saving}
              placeholder="Street, city"
            />
          </FieldRow>
        </FieldGroup>

        <FieldGroup label="Notes">
          <textarea
            value={values.notes || ""}
            onChange={(event) => onChange("notes", event.target.value)}
            disabled={saving}
            placeholder="Private purchasing or relationship notes"
            className="item-panel-textarea"
          />
        </FieldGroup>
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
          className="rounded-xl border border-theme bg-theme-surface px-5 py-3 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !values.name.trim() || emailError}
          className={buttonClassName()}
        >
          {saving ? "Saving..." : "Save Supplier"}
        </button>
      </div>
    </form>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  // Every purchase order, once: a supplier's balance and history come from
  // the same list the Purchase Orders page shows.
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [currencyCode, setCurrencyCode] = useState(
    DEFAULT_BUSINESS_SETTINGS.currency_code || "USD"
  );
  const [accountSupplier, setAccountSupplier] = useState<Supplier | null>(null);
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
          getPurchaseOrdersForUser(user.id).catch(() => [] as PurchaseOrder[]),
          getOrCreateBusinessSettings(user.id).catch(() => DEFAULT_BUSINESS_SETTINGS),
        ])
          .then(([loadedSuppliers, loadedUsage, loadedOrders, settings]) => {
            if (!isActive) return;
            setSuppliers(loadedSuppliers);
            setUsage(loadedUsage);
            setPurchaseOrders(loadedOrders);
            setCurrencyCode(settings.currency_code || "USD");
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

  /* Orders by supplier: how many, what is still owed, what is on its way.
     Drafts and cancelled orders are neither money nor goods. */
  const accounts = useMemo(() => {
    const map = new Map<
      number,
      { orders: PurchaseOrder[]; owed: number; spent: number; expected: number }
    >();
    for (const order of purchaseOrders) {
      if (order.supplier_id === null) continue;
      const entry = map.get(order.supplier_id) || {
        orders: [],
        owed: 0,
        spent: 0,
        expected: 0,
      };
      entry.orders.push(order);
      if (order.status !== "draft" && order.status !== "cancelled") {
        entry.spent += getPurchaseOrderTotal(order);
        entry.owed += getPurchaseOrderBalance(order).remaining;
        if (isPurchaseOrderOpen(order)) entry.expected += 1;
      }
      map.set(order.supplier_id, entry);
    }
    return map;
  }, [purchaseOrders]);

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
        <DashboardPageShell>
          <DashboardPageHeader
            eyebrow="Purchasing contacts"
            title="Suppliers"
            description="Keep vendor contacts organized and connect them to inventory when useful."
            actions={
              <>
                <ActionButton
                  href="/dashboard/inventory"
                  variant="secondary"
                  className="organize-inventory-link"
                >
                  Inventory
                </ActionButton>
                <ActionButton
                  onClick={openCreateForm}
                  disabled={loading || limitReached}
                  icon="plus"
                >
                  Add Supplier
                </ActionButton>
              </>
            }
          />

          {(pageError || pageNotice) && (
            <DashboardNotice tone={pageError ? "danger" : "success"}>
              {pageError || pageNotice}
            </DashboardNotice>
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

          <DashboardToolbar className="organize-search-card sm:p-5">
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
            <FilterBar label="Supplier filters" className="mt-4">
              {supplierFilters.map((filter) => (
                <FilterChip
                  key={filter.value}
                  active={supplierFilter === filter.value}
                  count={filter.count}
                  onClick={() => setSupplierFilter(filter.value)}
                >
                  {filter.label}
                </FilterChip>
              ))}
            </FilterBar>
          </DashboardToolbar>
          <ResultsAnnouncer count={visibleSuppliers.length} noun="supplier" />

          {loading ? (
            <LoadingSkeletonGroup
              count={3}
              className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              itemClassName="min-h-72"
            />
          ) : visibleSuppliers.length > 0 ? (
            <div className="organize-list-grid grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleSuppliers.map((supplier) => {
                const whatsappHref = supplier.whatsapp
                  ? getWhatsAppHref(supplier.whatsapp)
                  : "";

                return (
                  <article
                    key={supplier.id}
                    className="organize-row organize-supplier-row dashboard-card flex flex-col"
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
                      <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {(() => {
                          const account = accounts.get(supplier.id);
                          if (!account || account.orders.length === 0) return null;
                          return account.owed > 0 ? (
                            <Badge tone="warning">
                              Owe {formatInventoryPrice(account.owed, currencyCode)}
                            </Badge>
                          ) : (
                            <Badge tone="success">Settled</Badge>
                          );
                        })()}
                        <span className="rounded-full border border-sydin-blue/20 bg-sydin-blue/10 px-3 py-1.5 text-xs font-bold text-theme-accent">
                          {supplier.item_count || 0} items
                        </span>
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
                        <span className="max-w-full break-all rounded-full border border-sydin-blue/25 bg-sydin-blue/10 px-3 py-1.5 text-xs font-semibold text-theme-accent">
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

                    <div className="organize-row-actions mt-auto pt-4">
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
                              ? "border-sydin-blue/25 bg-sydin-blue/10 text-theme-accent hover:bg-sydin-blue/20"
                              : "pointer-events-none border-white/5 bg-white/[0.02] text-theme-subtle"
                          }`}
                        >
                          Email
                        </a>
                      </div>

                      {/* Was a full-width 2-column grid of bespoke buttons on
                          its own row, which is most of why a supplier card ran
                          to 267px against Depots' 123px. Shared buttons, sized
                          to their content. */}
                      <div className="organize-desktop-actions mt-2 flex flex-wrap gap-2">
                        <ActionButton onClick={() => setAccountSupplier(supplier)}>
                          Account
                        </ActionButton>
                        <ActionButton onClick={() => openEditForm(supplier)}>
                          Edit
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          onClick={() => setPendingDelete(supplier)}
                        >
                          Delete
                        </ActionButton>
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
            <DashboardEmptyState
              icon="suppliers"
              title={
                suppliers.length === 0
                  ? "Add your first supplier"
                  : "No suppliers found"
              }
              description={
                suppliers.length === 0
                  ? "Supplier links are optional. Your existing items can stay without a supplier."
                  : "Try a different name, contact, phone number, email, or note."
              }
              action={
                suppliers.length === 0 && !limitReached ? (
                  <ActionButton onClick={openCreateForm} icon="plus">
                    Add your first supplier
                  </ActionButton>
                ) : null
              }
            />
          )}
        </DashboardPageShell>
      </main>

      {formOpen && (
        <div className="organize-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="my-6 max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[20px] border border-theme bg-theme-surface p-5 shadow-[0_20px_70px_rgba(15,23,42,0.16)] sm:p-6">
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

      {accountSupplier && (() => {
        const account = accounts.get(accountSupplier.id) || {
          orders: [],
          owed: 0,
          spent: 0,
          expected: 0,
        };
        const orders = [...account.orders].sort((a, b) =>
          (b.purchase_date || b.created_at).localeCompare(a.purchase_date || a.created_at)
        );
        return (
          <SheetShell
            title={accountSupplier.name}
            eyebrow="Supplier account"
            description={
              [accountSupplier.contact_name, accountSupplier.phone, accountSupplier.email]
                .filter(Boolean)
                .join(" · ") || undefined
            }
            onClose={() => setAccountSupplier(null)}
            footer={
              <>
                <Button variant="secondary" onClick={() => setAccountSupplier(null)}>
                  Close
                </Button>
                <Link
                  href={`/dashboard/purchase-orders/new?supplier=${accountSupplier.id}`}
                  className={buttonClassName()}
                >
                  New purchase order
                </Link>
              </>
            }
          >
            <div className="grid gap-4">
              {account.orders.length > 0 && (
              <div className="po-balance-strip">
                <div>
                  <small>Ordered</small>
                  <strong>{formatInventoryPrice(account.spent, currencyCode) || "—"}</strong>
                </div>
                <div>
                  <small>Paid</small>
                  <strong>
                    {formatInventoryPrice(
                      Math.max(0, account.spent - account.owed),
                      currencyCode
                    ) || "—"}
                  </strong>
                </div>
                <div
                  className={
                    account.owed > 0 ? "po-balance-remaining-due" : "po-balance-remaining-clear"
                  }
                >
                  <small>{account.owed > 0 ? "You still owe" : "Settled"}</small>
                  <strong>
                    {account.owed > 0
                      ? formatInventoryPrice(account.owed, currencyCode)
                      : "✓"}
                  </strong>
                </div>
              </div>
              )}

              {account.expected > 0 && (
                <DashboardNotice tone="info">
                  {account.expected} order{account.expected === 1 ? "" : "s"} still
                  waiting on a delivery from this supplier.
                </DashboardNotice>
              )}

              <div className="grid gap-1.5">
                <p className="po-detail-label">Purchase orders</p>
                {orders.length === 0 ? (
                  <p className="text-sm text-theme-muted">
                    Nothing ordered from this supplier yet.
                  </p>
                ) : (
                  orders.map((order) => {
                    const remaining = getPurchaseOrderBalance(order).remaining;
                    const progress = getPurchaseOrderReceivingProgress(order);
                    return (
                      <Link
                        key={order.id}
                        href={`/dashboard/purchase-orders?open=${order.id}`}
                        className="po-detail-line"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-theme-primary">
                            {order.po_number}
                            {order.title ? ` — ${order.title}` : ""}
                          </span>
                          <span className="block truncate text-xs font-semibold text-theme-muted">
                            {[
                              order.purchase_date || order.created_at.slice(0, 10),
                              PURCHASE_ORDER_STATUS_LABELS[order.status],
                              isPurchaseOrderOpen(order) && order.status !== "draft"
                                ? `${progress.remaining} units to come`
                                : "",
                              remaining > 0 && order.status !== "cancelled" && order.status !== "draft"
                                ? `${formatInventoryPrice(remaining, currencyCode)} still owed`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-black text-theme-primary">
                          {formatInventoryPrice(getPurchaseOrderTotal(order), currencyCode) || "—"}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </SheetShell>
        );
      })()}

      {pendingDelete && (
        <DialogShell
          title={`Delete ${pendingDelete.name}?`}
          eyebrow="Delete supplier"
          description="Inventory items will not be deleted. They will become No supplier."
          tone="danger"
          onClose={() => {
            if (!deletingId) setPendingDelete(null);
          }}
          closeDisabled={deletingId !== null}
          className="max-w-md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setPendingDelete(null)}
                disabled={deletingId !== null}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={deletingId !== null}
                loading={deletingId !== null}
                loadingLabel="Deleting..."
                className="flex-1"
              >
                Delete Supplier
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
