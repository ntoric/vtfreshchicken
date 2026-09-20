"use client";

import { useRef, useState, useCallback } from "react";
import type { Order, Currency, TenantSettings } from "@/types";
import { formatPrice } from "@/lib/format";
import { useToast } from "@/components/Toast";

interface InvoiceGeneratorProps {
  order: Order;
  currencyObj?: Currency;
  settings?: TenantSettings;
  tenantName?: string;
  transactionId?: string;
  paymentMethod?: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Credit / Debit Card",
  paypal: "PayPal",
  cod: "Cash on Delivery",
  razorpay: "Razorpay",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: "PAID", color: "#10b981" },
  pending: { label: "PENDING", color: "#f59e0b" },
  failed: { label: "FAILED", color: "#ef4444" },
  shipped: { label: "SHIPPED", color: "#3b82f6" },
  delivered: { label: "DELIVERED", color: "#10b981" },
  cancelled: { label: "CANCELLED", color: "#6b7280" },
};

export function InvoiceGenerator({
  order,
  currencyObj,
  settings,
  tenantName,
  transactionId,
  paymentMethod,
}: InvoiceGeneratorProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();

  const handleDownload = useCallback(() => {
    setIsGenerating(true);

    // Build a standalone HTML invoice in a new window for printing
    const invoiceHTML = buildInvoiceHTML({
      order,
      currencyObj,
      settings,
      tenantName,
      transactionId,
      paymentMethod,
    });

    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) {
      toast.warning("Popups blocked", "Please allow popups to download the invoice.");
      setIsGenerating(false);
      return;
    }

    printWindow.document.write(invoiceHTML);
    printWindow.document.close();

    // Wait for the window to load, then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        setIsGenerating(false);
      }, 300);
    };
  }, [order, currencyObj, settings, tenantName, transactionId, paymentMethod]);

  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(order.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={isGenerating}
        className="flex items-center justify-center gap-2 bg-brand text-white font-semibold py-3 px-6 rounded-xl hover:bg-brand-dark transition shadow-md disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M16.023 9.348h4.992M2.985 19.644v-4.992M19.644 2.985l-3.232 3.232M5.376 18.624l3.232-3.232M9.348 16.023v4.992M19.644 2.985H14.652M2.985 14.652V9.348" />
            </svg>
            Preparing Invoice...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download Invoice
          </>
        )}
      </button>

      {/* Hidden printable invoice (not used directly — the new window approach is used instead) */}
      <div ref={invoiceRef} className="hidden" />
    </div>
  );
}

// ============================================================
// Invoice HTML builder — generates a standalone printable HTML document
// ============================================================
function buildInvoiceHTML(opts: {
  order: Order;
  currencyObj?: Currency;
  settings?: TenantSettings;
  tenantName?: string;
  transactionId?: string;
  paymentMethod?: string;
}): string {
  const { order, currencyObj, settings, tenantName, transactionId, paymentMethod } = opts;
  const brandColor = settings?.brand_color || "#4f46e5";
  const storeName = tenantName || settings?.logo_url || "TruCommerce";
  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(order.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const invoiceNumber = `INV-${orderNumber}`;
  const statusInfo = STATUS_LABELS[order.status] || { label: order.status.toUpperCase(), color: "#6b7280" };
  const payLabel = PAYMENT_METHOD_LABELS[paymentMethod || ""] || paymentMethod || "N/A";

  const fmt = (n: number) => formatPrice(n, currencyObj);

  const shippingAddr = order.shipping_address;
  const billingAddr = order.billing_address || order.shipping_address;

  const itemsRows = (order.items || [])
    .map(
      (item, i) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;">${i + 1}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;color:#111827;">${escapeHtml(item.name)}</div>
          <div style="font-size:12px;color:#6b7280;">SKU: ${escapeHtml(item.sku)}</div>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;text-align:right;">${fmt(item.unit_price)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmt(item.line_total)}</td>
      </tr>
    `
    )
    .join("");

  const addressBlock = (addr: typeof shippingAddr, title: string) => {
    if (!addr) return `<div style="flex:1;"><h3 style="font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">${title}</h3><p style="color:#6b7280;font-size:13px;">N/A</p></div>`;
    return `
      <div style="flex:1;">
        <h3 style="font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">${title}</h3>
        <p style="color:#111827;font-size:13px;font-weight:600;">${escapeHtml(addr.first_name || "")} ${escapeHtml(addr.last_name || "")}</p>
        <p style="color:#6b7280;font-size:13px;">${escapeHtml(addr.line1 || "")}</p>
        ${addr.line2 ? `<p style="color:#6b7280;font-size:13px;">${escapeHtml(addr.line2)}</p>` : ""}
        <p style="color:#6b7280;font-size:13px;">${escapeHtml(addr.city || "")}, ${escapeHtml(addr.state || "")} ${escapeHtml(addr.postal_code || "")}</p>
        <p style="color:#6b7280;font-size:13px;">${escapeHtml(addr.country || "")}</p>
        ${addr.email ? `<p style="color:#6b7280;font-size:13px;">${escapeHtml(addr.email)}</p>` : ""}
        ${addr.phone ? `<p style="color:#6b7280;font-size:13px;">${escapeHtml(addr.phone)}</p>` : ""}
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${invoiceNumber} - ${storeName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; color: #1f2937; padding: 40px 20px; }
  .invoice-container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); }
  .invoice-header { background: linear-gradient(135deg, ${brandColor}, ${brandColor}dd); color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; align-items: center; }
  .invoice-header h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .invoice-header .invoice-meta { text-align: right; }
  .invoice-header .invoice-meta .inv-num { font-size: 20px; font-weight: 700; }
  .invoice-header .invoice-meta .inv-date { font-size: 13px; opacity: 0.8; margin-top: 4px; }
  .invoice-body { padding: 32px 40px; }
  .store-info { margin-bottom: 32px; }
  .store-info .store-name { font-size: 22px; font-weight: 700; color: #111827; }
  .store-info .store-sub { font-size: 13px; color: #6b7280; margin-top: 2px; }
  .addresses { display: flex; gap: 40px; margin-bottom: 32px; }
  .status-badge { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; background: ${statusInfo.color}20; color: ${statusInfo.color}; border: 1px solid ${statusInfo.color}40; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; background: #f9fafb; border-radius: 8px; padding: 20px; }
  .meta-grid .meta-item .label { font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px; }
  .meta-grid .meta-item .value { font-size: 14px; font-weight: 600; color: #111827; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #f3f4f6; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; font-weight: 600; }
  thead th:nth-child(3) { text-align: center; }
  thead th:nth-child(4), thead th:nth-child(5) { text-align: right; }
  .totals { margin-left: auto; width: 300px; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
  .totals .row span:first-child { color: #6b7280; }
  .totals .row span:last-child { font-weight: 500; color: #111827; }
  .totals .row.discount span:last-child { color: #10b981; }
  .totals .row.grand { border-top: 2px solid #111827; margin-top: 8px; padding-top: 16px; }
  .totals .row.grand span:first-child { font-weight: 700; color: #111827; font-size: 16px; }
  .totals .row.grand span:last-child { font-weight: 800; color: #111827; font-size: 22px; }
  .footer { padding: 24px 40px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; }
  .footer p { font-size: 12px; color: #6b7280; line-height: 1.6; }
  .footer .thank-you { font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 8px; }
  @media print {
    body { background: #fff; padding: 0; }
    .invoice-container { box-shadow: none; border-radius: 0; max-width: 100%; }
    @page { margin: 20px; }
  }
</style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="invoice-header">
      <div>
        <h1>INVOICE</h1>
        <p style="font-size:13px;opacity:0.8;margin-top:4px;">${escapeHtml(storeName)}</p>
      </div>
      <div class="invoice-meta">
        <div class="inv-num">${invoiceNumber}</div>
        <div class="inv-date">${orderDate}</div>
      </div>
    </div>

    <!-- Body -->
    <div class="invoice-body">
      <!-- Store info -->
      <div class="store-info">
        <div class="store-name">${escapeHtml(storeName)}</div>
        <div class="store-sub">Thank you for your business!</div>
      </div>

      <!-- Status -->
      <div style="margin-bottom: 24px;">
        <span class="status-badge">${statusInfo.label}</span>
      </div>

      <!-- Meta grid -->
      <div class="meta-grid">
        <div class="meta-item">
          <div class="label">Order Number</div>
          <div class="value">#${orderNumber}</div>
        </div>
        <div class="meta-item">
          <div class="label">Order Date</div>
          <div class="value">${orderDate}</div>
        </div>
        <div class="meta-item">
          <div class="label">Payment Method</div>
          <div class="value">${escapeHtml(payLabel)}</div>
        </div>
        <div class="meta-item">
          <div class="label">Transaction ID</div>
          <div class="value" style="font-family:monospace;font-size:12px;">${escapeHtml(transactionId || "N/A")}</div>
        </div>
      </div>

      <!-- Addresses -->
      <div class="addresses">
        ${addressBlock(billingAddr, "Billing Address")}
        ${addressBlock(shippingAddr, "Shipping Address")}
      </div>

      <!-- Items table -->
      <table>
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>Product</th>
            <th style="width:80px;">Qty</th>
            <th style="width:120px;">Unit Price</th>
            <th style="width:120px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- Totals -->
      <div class="totals">
        <div class="row">
          <span>Subtotal</span>
          <span>${fmt(order.subtotal)}</span>
        </div>
        ${order.discount_total > 0 ? `<div class="row discount"><span>Discount</span><span>−${fmt(order.discount_total)}</span></div>` : ""}
        <div class="row">
          <span>Shipping</span>
          <span>${order.shipping_total === 0 ? "FREE" : fmt(order.shipping_total)}</span>
        </div>
        <div class="row">
          <span>Tax</span>
          <span>${fmt(order.tax_total)}</span>
        </div>
        <div class="row grand">
          <span>Total</span>
          <span>${fmt(order.grand_total)}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="thank-you">Thank you for shopping with ${escapeHtml(storeName)}!</p>
      <p>This is a computer-generated invoice and does not require a signature.</p>
      <p>For any questions about your order, please contact support.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
