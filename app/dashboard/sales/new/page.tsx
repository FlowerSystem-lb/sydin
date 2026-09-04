"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/UiIcon";
import {
  DashboardNotice,
  DashboardPageHeader,
  DashboardPageShell,
} from "@/components/dashboard/Workspace";
import { Button, Select } from "@/components/ui";
import { supabase } from "@/app/lib/supabase";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
} from "@/app/lib/businessSettings";
import { getCustomersForUser, type Customer } from "@/app/lib/customers";
import { getDepotsForUser, type Depot } from "@/app/lib/depots";
import {
  formatInventoryPrice,
  getInventoryUnitLabel,
} from "@/app/lib/inventoryItemModel";
import {
  createSalesOrder,
  getSalesOrderErrorMessage,
  suggestNextInvoiceNumber,
  type SalesOrderLineInput,
} from "@/app/lib/salesOrders";

interface SellableItem {
  id: number;
  name: string;
  sku: string | null;
  item_code: string | null;
  quantity: number;
  selling_price: number | string | null;
  unit_type: string | null;
  custom_unit_label: string | null;
}

interface DraftLine {
  key: string;
  itemId: number | null;
  name: string;
  sku: string | null;
  itemCode: string | null;
  unitLabel: string | null;
  quantity: string;
  unitPrice: string;
  /** In stock right now, so the screen can warn before the invoice is issued. */
  available: number | null;
}

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Build an invoice.
 *
 * Saved as a DRAFT. Nothing leaves stock here -- issuing does that, and issuing
 * is the next step. A draft can be wrong and edited; an issued invoice has
 * already moved goods and been shown to a customer, which is why they are
 * separate actions rather than one Save button.
 */
export default function NewSalePage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [items, setItems] = useState<SellableItem[]>([]);
  const [currencyCode, setCurrencyCode] = useState(
    DEFAULT_BUSINESS_SETTINGS.currency_code
  );

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [issueDate, setIssueDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!isActive) return;

        if (!user) {
          setError("Please sign in again to raise an invoice.");
          return;
        }

        const [customerRows, depotRows, settings, suggested, itemResult] =
          await Promise.all([
            getCustomersForUser(user.id),
            getDepotsForUser(user.id),
            getOrCreateBusinessSettings(user.id),
            suggestNextInvoiceNumber(user.id),
            supabase
              .from("inventory")
              .select(
                "id, name, sku, item_code, quantity, selling_price, unit_type, custom_unit_label"
              )
              .eq("user_id", user.id)
              .order("name", { ascending: true }),
          ]);

        if (!isActive) return;

        setCustomers(customerRows);
        setDepots(depotRows);
        setItems((itemResult.data as SellableItem[] | null) || []);
        setCurrencyCode(
          settings?.currency_code || DEFAULT_BUSINESS_SETTINGS.currency_code
        );
        setInvoiceNumber(suggested);
      })
      .catch(() => {
        if (isActive) setError("We could not load this page. Please refresh.");
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
        0
      ),
    [lines]
  );

  const overStock = useMemo(
    () =>
      lines.filter(
        (line) =>
          line.itemId !== null &&
          line.available !== null &&
          Number(line.quantity) > line.available
      ),
    [lines]
  );

  const addItemLine = (itemId: string) => {
    const item = items.find((candidate) => String(candidate.id) === itemId);
    if (!item) return;

    setLines((current) => [
      ...current,
      {
        key: newKey(),
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        itemCode: item.item_code,
        unitLabel: getInventoryUnitLabel(item.unit_type, item.custom_unit_label),
        quantity: "1",
        /* The product's selling price is a starting point, not a rule. It is
           copied into the line so it can be changed for this customer without
           touching the catalogue -- and once saved, the line keeps what was
           agreed even if the catalogue price moves later. */
        unitPrice: item.selling_price ? String(item.selling_price) : "",
        available: Number(item.quantity) || 0,
      },
    ]);
  };

  const addChargeLine = () => {
    setLines((current) => [
      ...current,
      {
        key: newKey(),
        itemId: null,
        name: "",
        sku: null,
        itemCode: null,
        unitLabel: null,
        quantity: "1",
        unitPrice: "",
        available: null,
      },
    ]);
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const save = async () => {
    if (saving) return;

    if (!invoiceNumber.trim()) {
      setError("Give this invoice a number.");
      return;
    }

    if (lines.length === 0) {
      setError("Add at least one line before saving.");
      return;
    }

    const blankCharge = lines.find(
      (line) => line.itemId === null && !line.name.trim()
    );
    if (blankCharge) {
      setError("Every charge needs a description.");
      return;
    }

    const badQuantity = lines.find((line) => !(Number(line.quantity) > 0));
    if (badQuantity) {
      setError("Every line needs a quantity above zero.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session expired. Sign in again and retry.");
      return;
    }

    const customer = customers.find(
      (candidate) => String(candidate.id) === customerId
    );
    const depot = depots.find((candidate) => String(candidate.id) === depotId);

    const payload: SalesOrderLineInput[] = lines.map((line) => ({
      line_type: line.itemId === null ? "charge" : "inventory",
      inventory_item_id: line.itemId,
      /* Every product line is marked as stock-affecting now, so that issuing
         later knows exactly what to take out without re-deciding. A charge
         never is -- the database refuses it either way. */
      affects_stock: line.itemId !== null,
      name_snapshot: line.name.trim(),
      sku_snapshot: line.sku,
      item_code_snapshot: line.itemCode,
      unit_label_snapshot: line.unitLabel,
      quantity: Number(line.quantity),
      unit_price: line.unitPrice === "" ? null : Number(line.unitPrice),
    }));

    try {
      setSaving(true);
      setError("");

      const created = await createSalesOrder(user.id, {
        invoice_number: invoiceNumber,
        customer_id: customer ? customer.id : null,
        customer_name_snapshot: customer ? customer.name : null,
        customer_contact_snapshot: customer
          ? customer.phone || customer.email || null
          : null,
        depot_id: depot ? depot.id : null,
        depot_name_snapshot: depot ? depot.name : null,
        issue_date: issueDate || null,
        currency_code: currencyCode,
        notes: notes.trim() || null,
        lines: payload,
      });

      router.push(`/dashboard/sales/${created.id}`);
    } catch (saveError) {
      setError(getSalesOrderErrorMessage(saveError));
      setSaving(false);
    }
  };

  return (
    <main className="operations-workspace">
      <DashboardPageShell>
        <DashboardPageHeader
          eyebrow="Selling"
          title="New invoice"
          description="Saved as a draft. Nothing leaves stock until you issue it."
        />

        {error && <DashboardNotice tone="danger">{error}</DashboardNotice>}

        {loading ? (
          <p className="mt-6 text-sm text-theme-muted">Loading...</p>
        ) : (
          <div className="mt-4 grid gap-4">
            <section className="dashboard-card grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Invoice number">
                <input
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  className="sale-input"
                />
              </Field>

              <Field label="Date">
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className="sale-input"
                />
              </Field>

              <Select
                label="Customer"
                value={customerId}
                onChange={setCustomerId}
                placeholder={
                  customers.length === 0 ? "No customers yet" : "Choose a customer"
                }
                searchable
                clearable
                options={customers.map((customer) => ({
                  value: String(customer.id),
                  label: customer.name,
                  description: customer.phone || customer.email || undefined,
                }))}
              />

              <Select
                label="Depot"
                value={depotId}
                onChange={setDepotId}
                placeholder="Any depot"
                clearable
                options={depots.map((depot) => ({
                  value: String(depot.id),
                  label: depot.name,
                }))}
              />
            </section>

            <section className="dashboard-card p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-sm font-semibold text-theme-primary">
                  What was sold
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-56">
                    <Select
                      value=""
                      onChange={addItemLine}
                      ariaLabel="Add a product to this invoice"
                      placeholder="Add a product"
                      searchable
                      searchPlaceholder="Search name, SKU or code"
                      options={items.map((item) => ({
                        value: String(item.id),
                        label: item.name,
                        description: `${item.quantity} in stock`,
                        keywords: `${item.sku || ""} ${item.item_code || ""}`,
                      }))}
                    />
                  </div>
                  <Button variant="secondary" onClick={addChargeLine}>
                    Add a charge
                  </Button>
                </div>
              </div>

              {lines.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-theme px-4 py-6 text-center text-sm text-theme-muted">
                  Nothing on this invoice yet. Add a product, or a charge such as
                  delivery.
                </p>
              ) : (
                <ul className="mt-4 grid gap-2">
                  {lines.map((line) => {
                    const lineTotal =
                      (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                    const short =
                      line.available !== null &&
                      Number(line.quantity) > line.available;

                    return (
                      <li
                        key={line.key}
                        className="grid gap-2 rounded-xl border border-theme bg-theme-inset p-3 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          {line.itemId === null ? (
                            <input
                              value={line.name}
                              onChange={(event) =>
                                updateLine(line.key, { name: event.target.value })
                              }
                              placeholder="Delivery, service, other"
                              className="sale-input"
                            />
                          ) : (
                            <>
                              <p className="truncate text-sm font-semibold text-theme-primary">
                                {line.name}
                              </p>
                              <p className="truncate text-xs text-theme-muted">
                                {[line.itemCode || line.sku, line.unitLabel]
                                  .filter(Boolean)
                                  .join(" · ")}
                                {line.available !== null
                                  ? ` · ${line.available} in stock`
                                  : ""}
                              </p>
                            </>
                          )}
                        </div>

                        <label className="grid gap-1 text-xs font-semibold text-theme-secondary">
                          <span className="sr-only sm:not-sr-only">Qty</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={line.quantity}
                            onChange={(event) =>
                              updateLine(line.key, { quantity: event.target.value })
                            }
                            className="sale-input"
                          />
                        </label>

                        <label className="grid gap-1 text-xs font-semibold text-theme-secondary">
                          <span className="sr-only sm:not-sr-only">Price</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={line.unitPrice}
                            onChange={(event) =>
                              updateLine(line.key, {
                                unitPrice: event.target.value,
                              })
                            }
                            className="sale-input"
                          />
                        </label>

                        <p className="text-sm font-semibold text-theme-primary tabular-nums sm:text-right">
                          {formatInventoryPrice(lineTotal, currencyCode) || "--"}
                        </p>

                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          aria-label={`Remove ${line.name || "this line"}`}
                          className="min-h-11 justify-self-start rounded-xl border border-theme bg-theme-surface px-3 text-xs font-semibold text-theme-muted transition hover:text-theme-danger sm:justify-self-end"
                        >
                          <UiIcon name="trash" className="h-4 w-4" />
                        </button>

                        {short && (
                          <p className="text-xs font-semibold text-theme-warning sm:col-span-5">
                            Only {line.available} in stock. You can save this
                            draft, but issuing it will be refused.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-theme pt-3">
                <span className="text-sm font-semibold text-theme-secondary">
                  Total
                </span>
                <span className="text-xl font-semibold text-theme-primary tabular-nums">
                  {formatInventoryPrice(total, currencyCode) || "--"}
                </span>
              </div>
            </section>

            <section className="dashboard-card p-4">
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Anything the customer should see on the invoice"
                  className="sale-input py-2"
                />
              </Field>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {overStock.length > 0 && (
                <p className="mr-auto text-xs font-semibold text-theme-warning">
                  {overStock.length} line
                  {overStock.length === 1 ? "" : "s"} above what is in stock.
                </p>
              )}
              <Button
                variant="secondary"
                onClick={() => router.push("/dashboard/sales")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void save()}
                loading={saving}
                loadingLabel="Saving..."
              >
                Save draft
              </Button>
            </div>
          </div>
        )}
      </DashboardPageShell>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-theme-secondary">
      {label}
      {children}
    </label>
  );
}
