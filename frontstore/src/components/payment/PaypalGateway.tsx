"use client";

import { useState, useEffect, FC } from "react";
import { Wallet } from "lucide-react";
import type { PaymentGatewayMeta, PaymentComponentProps, RegisteredGateway } from "@/lib/paymentRegistry";
import type { PaymentDetails } from "@/types";

const meta: PaymentGatewayMeta = {
  id: "paypal",
  name: "PayPal",
  description: "Pay with your PayPal account balance or linked card",
  icon: Wallet,
  group: "wallet",
  requires_redirect: true,
};

const PaypalGatewayForm: FC<PaymentComponentProps> = ({ onDetailsChange, isProcessing }) => {
  const [email, setEmail] = useState("");

  useEffect(() => {
    const valid = email.trim().length > 0 && email.includes("@") && email.includes(".");
    if (valid) {
      onDetailsChange({ paypal_email: email.trim() });
    } else {
      onDetailsChange(null);
    }
  }, [email, onDetailsChange]);

  return (
    <div className="bg-blue-50 rounded-xl p-5 space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-blue-100">
        <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7.076 21.567l.6-3.805-.065-.063H4.5L6.69 3.567c.045-.27.282-.47.557-.47h5.296c1.74 0 3.086.417 3.89 1.205.79.776 1.06 1.86.79 3.143l-.01.05v.06c-.27 1.42-1.06 2.55-2.25 3.21-1.13.63-2.55.96-4.21.96H8.95l-.6 3.79-.02.1-.06.06H7.076z" />
        </svg>
        <div className="text-sm">
          <p className="font-medium text-gray-900">PayPal Checkout</p>
          <p className="text-xs text-gray-500">You'll be redirected to PayPal to complete your purchase.</p>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">PayPal Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="john@example.com"
          disabled={isProcessing}
        />
      </div>
      <p className="text-xs text-gray-400">Demo mode — no actual PayPal redirect will occur.</p>
    </div>
  );
};

export const PaypalGateway: RegisteredGateway = {
  meta,
  Component: PaypalGatewayForm,
};

const inputCls = "w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand transition disabled:opacity-50";
