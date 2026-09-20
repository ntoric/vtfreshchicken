"use client";

import { useEffect, FC } from "react";
import { Banknote } from "lucide-react";
import type { PaymentGatewayMeta, PaymentComponentProps, RegisteredGateway } from "@/lib/paymentRegistry";
import type { PaymentDetails } from "@/types";

const meta: PaymentGatewayMeta = {
  id: "cod",
  name: "Cash on Delivery",
  description: "Pay with cash or card when your order arrives",
  icon: Banknote,
  group: "cash",
};

const CodGatewayForm: FC<PaymentComponentProps> = ({ onDetailsChange }) => {
  // COD requires no payment details — always valid
  useEffect(() => {
    onDetailsChange({});
  }, [onDetailsChange]);

  return (
    <div className="bg-emerald-50 rounded-xl p-5 space-y-3 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <svg className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75a.75.75 0 0 1-.75-.75V4.5M3.75 4.5h-.75M9 8.25h6m-6 4.5h6m-6 4.5h6M3 6v12a2.25 2.25 0 0 0 2.25 2.25h12A2.25 2.25 0 0 0 19.5 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6Z" />
        </svg>
        <div className="text-sm text-gray-700 space-y-1">
          <p className="font-medium text-gray-900">Pay on Delivery</p>
          <p>Pay with cash or card when your order is delivered to your door.</p>
          <p className="text-xs text-gray-500">A small handling fee may apply. Please have exact change ready.</p>
        </div>
      </div>
    </div>
  );
};

export const CodGateway: RegisteredGateway = {
  meta,
  Component: CodGatewayForm,
};
