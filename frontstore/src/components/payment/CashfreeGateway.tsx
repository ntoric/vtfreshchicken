"use client";

import { useState, useEffect, useCallback, FC } from "react";
import { Smartphone } from "lucide-react";
import type { PaymentGatewayMeta, PaymentComponentProps, RegisteredGateway } from "@/lib/paymentRegistry";

const meta: PaymentGatewayMeta = {
  id: "cashfree",
  name: "Cashfree",
  description: "UPI, Cards, Net Banking & Wallets (India)",
  icon: Smartphone,
  group: "wallet",
  requires_redirect: true,
};

// ---- Cashfree JS SDK v3 (minimal types) ----
interface CashfreeCheckoutResult {
  error?: { message?: string; code?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
}
interface CashfreeInstance {
  checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => Promise<CashfreeCheckoutResult>;
}
declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => CashfreeInstance;
  }
}

const SCRIPT_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

function loadCashfreeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const fail = () => reject(new Error("Failed to load Cashfree checkout. Check your connection and try again."));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", fail);
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = fail;
    document.body.appendChild(script);
  });
}

type Status = "idle" | "creating" | "open" | "success" | "error";

const CashfreeGatewayForm: FC<PaymentComponentProps> = ({
  amount,
  currencySymbol,
  currencyCode,
  customer,
  onDetailsChange,
  isProcessing,
  validateBeforePayment,
  onPaymentComplete,
}) => {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [demo, setDemo] = useState(false);

  // A completed payment is only valid for the amount it was made for.
  useEffect(() => {
    setStatus((s) => (s === "success" ? "idle" : s));
    setOrderId("");
  }, [amount]);

  useEffect(() => {
    onDetailsChange(status === "success" && orderId ? { cashfree_order_id: orderId } : null);
  }, [status, orderId, onDetailsChange]);

  const succeed = useCallback(
    (id: string, msg: string) => {
      setOrderId(id);
      setStatus("success");
      setMessage(msg);
      // Let the parent pick up the new payment details before placing the order.
      if (onPaymentComplete) setTimeout(onPaymentComplete, 0);
    },
    [onPaymentComplete],
  );

  const handlePay = useCallback(async () => {
    if (validateBeforePayment && !validateBeforePayment()) return;
    setStatus("creating");
    setMessage("Preparing secure checkout…");
    try {
      const { createGatewayOrder } = await import("@/lib/api");
      const order = await createGatewayOrder("cashfree", {
        amount,
        currency: currencyCode || "INR",
        customer_name: customer?.name,
        customer_email: customer?.email,
        customer_phone: customer?.phone,
      });

      if (order.mode === "demo") {
        setDemo(true);
        setStatus("open");
        setMessage("Demo Cashfree checkout — simulating payment…");
        setTimeout(() => succeed(order.gateway_order_id, "Payment completed (demo mode)."), 1200);
        return;
      }
      if (!order.payment_session_id) throw new Error("Cashfree did not return a payment session.");

      await loadCashfreeScript();
      const cashfree = window.Cashfree!({ mode: order.mode === "production" ? "production" : "sandbox" });
      setStatus("open");
      setMessage("Complete your payment in the Cashfree window.");

      const result = await cashfree.checkout({ paymentSessionId: order.payment_session_id, redirectTarget: "_modal" });
      if (result.error) {
        // Closing the popup also reports an error — treat it as a cancel.
        setStatus("idle");
        setMessage(result.error.message || "");
        return;
      }
      // The popup result isn't proof of payment — the server verifies the
      // order with Cashfree when the order is placed.
      succeed(order.gateway_order_id, "Payment received. Placing your order…");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Could not start Cashfree payment.");
    }
  }, [amount, currencyCode, customer?.name, customer?.email, customer?.phone, validateBeforePayment, succeed]);

  const busy = isProcessing || status === "creating" || status === "open";

  return (
    <div className="bg-violet-50 rounded-xl p-5 space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-violet-100">
        <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          CF
        </div>
        <div className="text-sm">
          <p className="font-medium text-gray-900">Cashfree Secure Checkout</p>
          <p className="text-xs text-gray-500">UPI · Cards · Net Banking · Wallets</p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-violet-100">
        <span className="text-sm text-gray-600">Amount to Pay</span>
        <span className="text-lg font-bold text-gray-900">{currencySymbol}{amount.toFixed(2)}</span>
      </div>

      {demo && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          Demo mode — no Cashfree credentials configured, so payment is simulated. Add the App ID and Secret Key in Backoffice → Developer to take real payments.
        </div>
      )}

      {(status === "creating" || status === "open") && (
        <p className="text-sm text-violet-700 animate-pulse">{message}</p>
      )}

      {status === "success" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
          <p className="font-medium">{message}</p>
          <p className="text-xs mt-1 text-emerald-600">Cashfree reference: {orderId}</p>
        </div>
      )}

      {status === "error" && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{message}</div>
      )}

      {status !== "success" && (
        <button
          type="button"
          onClick={handlePay}
          disabled={busy}
          className="w-full bg-violet-600 text-white font-semibold py-2.5 rounded-lg hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "creating" ? "Preparing…" : status === "open" ? "Checkout open…" : "Pay with Cashfree"}
        </button>
      )}

      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 pt-1">
        {["UPI", "Visa", "Mastercard", "RuPay", "Net Banking", "Wallets"].map((m) => (
          <span key={m} className="bg-white px-2 py-1 rounded border">{m}</span>
        ))}
      </div>
    </div>
  );
};

export const CashfreeGateway: RegisteredGateway = {
  meta,
  Component: CashfreeGatewayForm,
};
