"use client";

import Image from "next/image";
import type { Currency } from "@/types";
import type { Order } from "@/types";
import { formatPrice } from "@/lib/format";

interface OrderSummaryProps {
  order: Order;
  currencyObj?: Currency;
  transactionId?: string;
  paymentMethod?: string;
}

export function OrderSummary({ order, currencyObj, transactionId, paymentMethod }: OrderSummaryProps) {
  const orderDate = new Date(order.created_at).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-5">
      {/* Order info card */}
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide">Order Number</p>
            <p className="font-mono font-bold text-gray-900 mt-1">{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide">Order Date</p>
            <p className="font-medium text-gray-900 mt-1">{orderDate}</p>
          </div>
          {paymentMethod && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Payment Method</p>
              <p className="font-medium text-gray-900 mt-1 capitalize">{paymentMethod}</p>
            </div>
          )}
          {transactionId && (
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide">Transaction ID</p>
              <p className="font-mono text-xs text-gray-600 mt-1 truncate">{transactionId}</p>
            </div>
          )}
        </div>
      </div>

      {/* Shipping address */}
      {order.shipping_address && (
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            Shipping Address
          </h3>
          <div className="text-sm text-gray-600 space-y-0.5">
            <p className="font-medium text-gray-900">
              {order.shipping_address.first_name} {order.shipping_address.last_name}
            </p>
            <p>{order.shipping_address.line1}</p>
            {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
            <p>
              {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
            </p>
            <p>{order.shipping_address.country}</p>
            {order.shipping_address.email && <p className="text-gray-500">{order.shipping_address.email}</p>}
          </div>
        </div>
      )}

      {/* Order items */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-bold text-gray-900 mb-4">Items Ordered</h3>
        <div className="space-y-3">
          {order.items?.map((item) => (
            <div key={item.id} className="flex items-center gap-4 text-sm">
              <div className="relative w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 overflow-hidden">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill sizes="48px" className="object-cover" />
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.484M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">
                  Quantity: {item.quantity} × {formatPrice(item.unit_price, currencyObj)}
                  {item.tax_amount != null && item.tax_amount > 0 && (
                    <span className="text-gray-400"> · Tax: {formatPrice(item.tax_amount, currencyObj)}{item.tax_rate ? ` (${item.tax_rate.toFixed(2)}%)` : ""}</span>
                  )}
                </p>
                {item.shipping_method && (
                  <p className="text-xs text-gray-400">
                    Ships via <span className="capitalize">{item.shipping_method}</span>
                    {item.shipping_cost != null && item.shipping_cost > 0 && ` · ${formatPrice(item.shipping_cost, currencyObj)}`}
                    {item.shipping_weight != null && item.shipping_weight > 0 && ` · ${item.shipping_weight.toFixed(2)} kg`}
                  </p>
                )}
              </div>
              <p className="font-bold text-gray-900">{formatPrice(item.line_total, currencyObj)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Order totals */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatPrice(order.subtotal, currencyObj)}</span>
          </div>
          {order.discount_total > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span className="font-medium">−{formatPrice(order.discount_total, currencyObj)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Shipping{order.shipping_weight ? ` (${order.shipping_weight.toFixed(2)} kg)` : ""}</span>
            <span className="font-medium">
              {order.shipping_total === 0 ? <span className="text-emerald-600">FREE</span> : formatPrice(order.shipping_total, currencyObj)}
            </span>
          </div>
          {order.tax_breakdown && order.tax_breakdown.length > 0 ? (
            order.tax_breakdown.map((b, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-400">
                <span>Tax — {b.tax_class_name} ({b.rate_name}, {b.rate}%{b.compound ? ", compound" : ""})</span>
                <span>{formatPrice(b.tax_amount, currencyObj)}</span>
              </div>
            ))
          ) : null}
          <div className="flex justify-between">
            <span className="text-gray-600">Tax</span>
            <span className="font-medium">{formatPrice(order.tax_total, currencyObj)}</span>
          </div>
          <div className="border-t pt-3 flex justify-between items-baseline">
            <span className="font-bold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-gray-900">{formatPrice(order.grand_total, currencyObj)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
