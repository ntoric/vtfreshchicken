"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchBootstrap, fetchOrder } from "@/lib/api";
import { Header } from "@/components/Header";
import { FullPageLoader } from "@/components/Loaders";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { getCurrencySymbol } from "@/lib/format";
import type { OrderResponse } from "@/types";
import { useCurrencyLang } from "@/lib/currency-lang";

const ORDER_CTX_KEY = "tc_order_response";

function PendingContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const [cachedResponse, setCachedResponse] = useState<OrderResponse | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ORDER_CTX_KEY);
      if (raw) {
        setCachedResponse(JSON.parse(raw) as OrderResponse);
      }
    } catch {
      // ignore
    }
  }, []);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  const orderQ = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId!),
    enabled: !!orderId && !!bootstrapQ.data,
  });

  const bootstrap = bootstrapQ.data;
  const order = orderQ.data?.order;

  useEffect(() => {
    if (order?.currency_code) setCurrency(order.currency_code);
  }, [order]);

  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);

  if (bootstrapQ.isLoading || orderQ.isLoading) {
    return <FullPageLoader label="Loading your order" />;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Order not found.</p>
          <Link href={``} className="text-brand hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to store
          </Link>
        </div>
      </div>
    );
  }

  const paymentMethod = cachedResponse?.payment_method;
  const isCOD = paymentMethod === "cod";

  return (
    <div className="min-h-screen">
      {bootstrap && (
        <Header
         
          bootstrap={bootstrap}
          currency={currency}
          setCurrency={setCurrency}
          lang={lang}
          setLang={setLang}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Pending banner */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-100 mb-4 relative">
            <div className="absolute inset-0 rounded-full bg-amber-200 animate-ping opacity-30" />
            <svg className="w-12 h-12 text-amber-600 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Order Placed — Payment Pending</h1>
          <p className="text-gray-500 text-lg">
            Your order has been placed successfully. Payment will be collected {isCOD ? "on delivery" : "soon"}.
          </p>
        </div>

        {/* Status badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-bold text-amber-700 uppercase tracking-wide">Pending</span>
          </div>
        </div>

        {/* Order summary */}
        <OrderSummary
          order={order}
          currencyObj={currencyObj}
          transactionId={cachedResponse?.transaction_id}
          paymentMethod={paymentMethod}
        />

        {/* Payment instructions */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6 mt-5">
          <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
            Payment Instructions
          </h3>
          {isCOD ? (
            <div className="space-y-3 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">1</span>
                <p>Keep <span className="font-bold">{currencyObj?.symbol || "$"}{order.grand_total.toFixed(2)}</span> ready for payment when your order is delivered.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">2</span>
                <p>You can pay with cash or card to the delivery agent.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">3</span>
                <p>Please have exact change ready if paying with cash.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">1</span>
                <p>Your payment is being processed. This may take a few moments.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">2</span>
                <p>You will receive a confirmation email once payment is confirmed.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">3</span>
                <p>If payment is not completed within 24 hours, the order may be cancelled.</p>
              </div>
            </div>
          )}
        </div>

        {/* What's next */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">What happens next?</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">1</span>
              <p>We've received your order and are preparing it for shipment.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">2</span>
              <p>Your order will be shipped within 1-2 business days.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">3</span>
              <p>You will get a tracking number once your order ships.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/orders/${order.id}`}
            className="flex-1 bg-amber-600 text-white font-semibold py-2.5 rounded-lg text-center hover:bg-amber-700 transition shadow-md flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76V6.75A2.25 2.25 0 0 1 4.5 4.5h15A2.25 2.25 0 0 1 21.75 6.75v6a2.25 2.25 0 0 1-2.25 2.25H4.5A2.25 2.25 0 0 1 2.25 12.76ZM2.25 12.76V18A2.25 2.25 0 0 0 4.5 20.25h15A2.25 2.25 0 0 0 21.75 18v-5.24" />
            </svg>
            View Order Details
          </Link>
          <Link
            href={``}
            className="flex-1 border font-semibold py-2.5 rounded-lg text-center hover:bg-gray-50 transition text-gray-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.484M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PendingPage({ params }: { params: {} }) {
  return (
    <Suspense fallback={<FullPageLoader label="Loading" />}>
      <PendingContent />
    </Suspense>
  );
}
