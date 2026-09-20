"use client";

import { useState, useEffect, useRef, FC, useCallback } from "react";
import { Globe } from "lucide-react";
import type { PaymentGatewayMeta, PaymentComponentProps, RegisteredGateway } from "@/lib/paymentRegistry";
import type { PaymentDetails } from "@/types";

const meta: PaymentGatewayMeta = {
  id: "razorpay",
  name: "Razorpay",
  description: "UPI, Cards, Net Banking, Wallets & EMI (India)",
  icon: Globe,
  group: "wallet",
  requires_redirect: true,
};

// ---- Razorpay checkout.js types (minimal) ----
interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
  theme?: { color?: string };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature?: string;
}

interface RazorpayStatic {
  new (options: RazorpayOptions): {
    open: () => void;
    on?: (event: string, handler: () => void) => void;
  };
  PaymentFailure?: (err: unknown) => void;
}

declare global {
  interface Window {
    Razorpay?: RazorpayStatic;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay script")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay script"));
    document.body.appendChild(script);
  });
}

const RazorpayGatewayForm: FC<PaymentComponentProps> = ({ amount, currencySymbol, onDetailsChange, isProcessing }) => {
  const [status, setStatus] = useState<"idle" | "creating" | "modal_open" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [signature, setSignature] = useState("");
  const razorpayRef = useRef<{ open: () => void } | null>(null);
  const handlerRef = useRef<((response: RazorpayResponse) => void) | null>(null);

  // Fetch the gateway's public config (key_id, demo_mode) from the payment methods list
  useEffect(() => {
    // The parent payment page fetches methods; we read from the DOM data attribute
    // or we can fetch it ourselves. Simpler: accept it via a data attribute on the parent.
    // But the cleanest approach: fetch payment methods here.
    // Since this component is rendered after methods are loaded, we use a fetch.
    // However, to avoid duplicate fetches, we'll read from a global cache.
    const cached = (window as unknown as { __tcPaymentMethods?: { methods: Array<{ id: string; public_config?: Record<string, unknown> }> } }).__tcPaymentMethods;
    if (cached) {
      const rzp = cached.methods.find((m) => m.id === "razorpay");
      if (rzp?.public_config) {
        setKeyId((rzp.public_config.key_id as string) || "");
        setDemoMode(!!rzp.public_config.demo_mode);
      }
    }
  }, []);

  // Update parent when payment is completed
  useEffect(() => {
    if (status === "success" && orderId && paymentId) {
      onDetailsChange({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });
    } else if (status !== "success") {
      onDetailsChange(null);
    }
  }, [status, orderId, paymentId, signature, onDetailsChange]);

  const handlePayWithRazorpay = useCallback(async () => {
    setStatus("creating");
    setStatusMsg("Creating order...");

    try {
      // Load the Razorpay checkout.js script
      await loadRazorpayScript();

      // Create order via backend
      const { createGatewayOrder } = await import("@/lib/api");
      // We need the tenant — get it from the URL
      const pathParts = window.location.pathname.split("/");
      const tenant = pathParts[2] || "demo"; // /t/{tenant}/checkout/payment

      const orderResult = await createGatewayOrder(tenant, "razorpay", {
        amount,
        currency: "INR", // Razorpay default; backend handles conversion
      });

      setOrderId(orderResult.gateway_order_id);
      const rzpKey = orderResult.key_id || keyId || "rzp_test_demo_key";

      if (demoMode || rzpKey === "rzp_test_demo_key") {
        // Demo mode — simulate the Razorpay modal flow
        setStatus("modal_open");
        setStatusMsg("Demo Razorpay checkout — simulating payment...");
        setTimeout(() => {
          const fakePaymentId = `pay_demo_${Date.now()}`;
          setPaymentId(fakePaymentId);
          setSignature(`sig_demo_${Date.now()}`);
          setStatus("success");
          setStatusMsg("Payment completed (demo mode). Click 'Pay' below to confirm your order.");
        }, 1500);
        return;
      }

      // Real mode — open Razorpay checkout modal
      setStatus("modal_open");
      setStatusMsg("Razorpay checkout opened. Complete your payment in the modal.");

      const handler = (response: RazorpayResponse) => {
        setPaymentId(response.razorpay_payment_id);
        setSignature(response.razorpay_signature || "");
        setStatus("success");
        setStatusMsg("Payment completed. Click 'Pay' below to confirm your order.");
      };
      handlerRef.current = handler;

      const options: RazorpayOptions = {
        key: rzpKey,
        amount: orderResult.amount,
        currency: orderResult.currency,
        name: "TruCommerce",
        description: "Order Payment",
        order_id: orderResult.gateway_order_id,
        handler,
        modal: {
          ondismiss: () => {
            if (status !== "success") {
              setStatus("idle");
              setStatusMsg("");
            }
          },
        },
        theme: { color: "#4f46e5" },
      };

      const rzp = new window.Razorpay!(options);
      rzp.on!("payment.failed", () => {
        setStatus("error");
        setStatusMsg("Payment failed. Please try again.");
      });
      razorpayRef.current = rzp;
      rzp.open();
    } catch (err) {
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Failed to initiate Razorpay payment");
    }
  }, [amount, keyId, demoMode, status]);

  return (
    <div className="bg-indigo-50 rounded-xl p-5 space-y-4 animate-fade-in-up">
      {/* Razorpay header */}
      <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-indigo-100">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          R
        </div>
        <div className="text-sm">
          <p className="font-medium text-gray-900">Razorpay Secure Checkout</p>
          <p className="text-xs text-gray-500">UPI · Cards · Net Banking · Wallets · EMI</p>
        </div>
      </div>

      {/* Amount display */}
      <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-indigo-100">
        <span className="text-sm text-gray-600">Amount to Pay</span>
        <span className="text-lg font-bold text-gray-900">{currencySymbol}{amount.toFixed(2)}</span>
      </div>

      {demoMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>Demo mode active — no real Razorpay keys configured. Payment will be simulated. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable real payments.</span>
        </div>
      )}

      {/* Status messages */}
      {status === "creating" && (
        <div className="flex items-center gap-2 text-sm text-indigo-600">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M16.023 9.348h4.992M2.985 19.644v-4.992M19.644 2.985l-3.232 3.232M5.376 18.624l3.232-3.232M9.348 16.023v4.992M19.644 2.985H14.652M2.985 14.652V9.348" />
          </svg>
          {statusMsg}
        </div>
      )}

      {status === "modal_open" && !demoMode && (
        <div className="flex items-center gap-2 text-sm text-indigo-600">
          <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          {statusMsg}
        </div>
      )}

      {status === "success" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <div>
            <p className="font-medium">{statusMsg}</p>
            {paymentId && <p className="text-xs mt-1 text-emerald-600">Payment ID: {paymentId}</p>}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          {statusMsg}
        </div>
      )}

      {/* Pay with Razorpay button */}
      {status !== "success" && (
        <button
          onClick={handlePayWithRazorpay}
          disabled={isProcessing || status === "creating" || status === "modal_open"}
          className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
          </svg>
          {status === "creating" ? "Creating Order..." : status === "modal_open" ? "Checkout Open..." : "Pay with Razorpay"}
        </button>
      )}

      {/* Reset button after success */}
      {status === "success" && (
        <button
          onClick={() => {
            setStatus("idle");
            setStatusMsg("");
            setOrderId("");
            setPaymentId("");
            setSignature("");
          }}
          disabled={isProcessing}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Use a different payment method
        </button>
      )}

      {/* Payment methods icons */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 pt-1">
        <span className="bg-white px-2 py-1 rounded border">UPI</span>
        <span className="bg-white px-2 py-1 rounded border">Visa</span>
        <span className="bg-white px-2 py-1 rounded border">Mastercard</span>
        <span className="bg-white px-2 py-1 rounded border">RuPay</span>
        <span className="bg-white px-2 py-1 rounded border">Net Banking</span>
        <span className="bg-white px-2 py-1 rounded border">Wallets</span>
        <span className="bg-white px-2 py-1 rounded border">EMI</span>
      </div>
    </div>
  );
};

export const RazorpayGateway: RegisteredGateway = {
  meta,
  Component: RazorpayGatewayForm,
};
