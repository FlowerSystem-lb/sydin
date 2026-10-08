"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { buttonClassName } from "@/components/ui";
import { supabase } from "@/app/lib/supabase";
import { formatExactPrice } from "@/app/lib/currency";
import { formatDocumentDate } from "@/app/lib/documentPdf";
import { paymentMethodLabel } from "@/app/lib/paymentMethods";
import { exportPurchaseOrderPdf } from "@/app/lib/purchaseOrderPdfExport";
import { PURCHASE_ORDER_PAYMENT_TERMS_LABELS, type PurchaseOrderPaymentTerms } from "@/app/lib/purchaseOrders";
import { formatDepotPhone } from "@/app/lib/depots";

/*
 * The supplier's copy of a purchase order: /po/<token> (9 Oct 2026). Opened
 * from WhatsApp or the QR on the printed PDF. The token is random and only
 * reads what the supplier was sent (get_public_purchase_order, phase 40).
 * Someone signed in to the business that owns the order goes straight to the
 * order in the dashboard instead, like the item QR codes.
 */

interface PublicOrder {
  order: {
    po_number: string;
    title: string | null;
    status: string;
    payment_status: string;
    purchase_date: string | null;
    expected_delivery_date: string | null;
    payment_terms: PurchaseOrderPaymentTerms | null;
    internal_reference: string | null;
    notes: string | null;
    currency_code: string | null;
    discount: number;
    delivery_fee: number;
    amount_paid: number | null;
    supplier_name: string | null;
    supplier_contact: string | null;
    depot_name: string | null;
  };
  lines: Array<{
    name: string;
    code: string | null;
    unit: string | null;
    line_type: string;
    quantity: number;
    received_quantity: number;
    unit_cost: number | null;
    notes: string | null;
  }>;
  payments: Array<{ amount: number; method: string | null; paid_at: string }>;
  business: { name: string | null; logo_url: string | null; phone: string | null; email: string | null; tax_id: string | null; address: string | null } | null;
  depot: { name: string | null; address: string | null; phone: string | null } | null;
  supplier: { name: string | null; contact_name: string | null; phone: string | null; email: string | null; address: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  ordered: "Ordered",
  partially_received: "Partly received",
  received: "Received",
  cancelled: "Cancelled",
};

export default function PublicPurchaseOrderPage() {
  const params = useParams();
  const raw = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = raw || "";
  const [data, setData] = useState<PublicOrder | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // A member of the owning business: open the order in the dashboard.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && /^[0-9a-f-]{36}$/i.test(token)) {
        const { data: own } = await supabase.from("purchase_orders").select("id").eq("public_token", token).maybeSingle();
        if (own?.id) {
          window.location.replace(`/dashboard/purchase-orders/${own.id}`);
          return;
        }
      }
      if (!/^[0-9a-f-]{36}$/i.test(token)) {
        if (active) setState("missing");
        return;
      }
      const { data: result, error } = await supabase.rpc("get_public_purchase_order", { p_token: token });
      if (!active) return;
      if (error || !result) {
        setState("missing");
        return;
      }
      setData(result as PublicOrder);
      setState("ready");
    })().catch(() => {
      if (active) setState("missing");
    });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    document.title = data ? `${data.order.po_number} · Purchase order` : "Purchase order";
  }, [data]);

  const currency = data?.order.currency_code || "USD";
  const money = (value: number | null | undefined) => formatExactPrice(Number(value || 0), currency) || "—";

  const download = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const businessName = data.business?.name || "SydIN Account";
      await exportPurchaseOrderPdf({
        details: {
          poNumber: data.order.po_number,
          title: data.order.title || undefined,
          supplierName: data.supplier?.name || data.order.supplier_name || "Not set",
          supplierContact: data.order.supplier_contact || undefined,
          supplierContactName: data.supplier?.contact_name || undefined,
          supplierPhone: data.supplier?.phone || undefined,
          supplierEmail: data.supplier?.email || undefined,
          supplierAddress: data.supplier?.address || undefined,
          depotName: data.depot?.name || data.order.depot_name || undefined,
          depotAddress: data.depot?.address || undefined,
          depotPhone: data.depot?.phone ? formatDepotPhone(data.depot.phone) : undefined,
          purchaseDate: data.order.purchase_date || undefined,
          expectedDeliveryDate: data.order.expected_delivery_date || undefined,
          status: STATUS_LABEL[data.order.status] || data.order.status,
          statusKey: data.order.status,
          paymentStatusKey: data.order.payment_status,
          paymentTermsLabel: data.order.payment_terms ? PURCHASE_ORDER_PAYMENT_TERMS_LABELS[data.order.payment_terms] : undefined,
          amountPaid: data.order.amount_paid,
          payments: data.payments.map((payment) => ({
            amount: Number(payment.amount),
            paidAt: payment.paid_at,
            method: payment.method ? paymentMethodLabel(payment.method) : null,
          })),
          discount: Number(data.order.discount || 0),
          deliveryFee: Number(data.order.delivery_fee || 0),
          notes: data.order.notes || undefined,
          internalReference: data.order.internal_reference || data.order.title || undefined,
          qrUrl: window.location.href.split("?")[0],
        },
        lines: data.lines.map((line) => ({
          name: line.name,
          code: line.code || undefined,
          unit: line.unit || "unit",
          orderQuantity: Number(line.quantity),
          receivedQuantity: Number(line.received_quantity || 0),
          unitCost: line.unit_cost === null ? null : Number(line.unit_cost),
          lineTotal: line.unit_cost === null ? null : Number(line.unit_cost) * Number(line.quantity),
          note: line.notes || undefined,
          isGeneral: line.line_type === "expense",
        })),
        branding: {
          businessName,
          businessLogoUrl: data.business?.logo_url || undefined,
          phone: data.business?.phone || undefined,
          email: data.business?.email || undefined,
          taxId: data.business?.tax_id || undefined,
          address: data.business?.address || undefined,
        },
        currencyCode: currency,
      });
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <main className="ppo-screen">
        <div className="ppo-card ppo-center">Loading the purchase order…</div>
      </main>
    );
  }

  if (state === "missing" || !data) {
    return (
      <main className="ppo-screen">
        <div className="ppo-card ppo-center">
          <h1>This link is not available</h1>
          <p>Ask the business that sent it for a new link.</p>
        </div>
      </main>
    );
  }

  const subtotal = data.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_cost || 0), 0);
  const total = Math.max(0, subtotal - Number(data.order.discount || 0) + Number(data.order.delivery_fee || 0));

  return (
    <main className="ppo-screen">
      <div className="ppo-card">
        <header className="ppo-head">
          <div>
            <p className="ppo-from">{data.business?.name || "Purchase order"}</p>
            <h1>Purchase order</h1>
            <p className="ppo-number">{data.order.po_number}</p>
          </div>
          <span className={`ppo-status is-${data.order.status}`}>{STATUS_LABEL[data.order.status] || data.order.status}</span>
        </header>

        <dl className="ppo-meta">
          <div>
            <dt>Order date</dt>
            <dd>{formatDocumentDate(data.order.purchase_date)}</dd>
          </div>
          <div>
            <dt>Expected</dt>
            <dd>{data.order.expected_delivery_date ? formatDocumentDate(data.order.expected_delivery_date) : "Not set"}</dd>
          </div>
          <div>
            <dt>Deliver to</dt>
            <dd>
              {data.depot?.name || data.order.depot_name || data.business?.name}
              {data.depot?.address ? ` · ${data.depot.address}` : ""}
            </dd>
          </div>
        </dl>

        <ul className="ppo-lines">
          {data.lines.map((line, index) => (
            <li key={`${line.name}-${index}`}>
              <span>
                <strong>{line.name}</strong>
                {line.code && <small>{line.code}</small>}
              </span>
              <span className="ppo-qty">× {line.quantity}</span>
              <span className="ppo-amount">{line.unit_cost === null ? "—" : money(Number(line.unit_cost) * Number(line.quantity))}</span>
            </li>
          ))}
        </ul>

        <div className="ppo-total">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>

        <button type="button" disabled={busy} onClick={() => void download()} className={buttonClassName({ className: "ppo-download" })}>
          {busy ? "Preparing…" : "Download PDF"}
        </button>
        {data.business?.phone && (
          <p className="ppo-contact">
            Questions? Call {data.business.name || "the business"} on <a href={`tel:${data.business.phone.replace(/[^\d+]/g, "")}`}>{data.business.phone}</a>
          </p>
        )}
        <p className="ppo-powered">Sent with SydIN</p>
      </div>
    </main>
  );
}
