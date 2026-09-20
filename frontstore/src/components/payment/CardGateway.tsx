"use client";

import { useState, useEffect, FC } from "react";
import { CreditCard } from "lucide-react";
import type { PaymentGatewayMeta, PaymentComponentProps, RegisteredGateway } from "@/lib/paymentRegistry";
import type { PaymentDetails } from "@/types";

const meta: PaymentGatewayMeta = {
  id: "card",
  name: "Credit / Debit Card",
  description: "Visa, Mastercard, Amex, Discover",
  icon: CreditCard,
  group: "card",
};

const CardGatewayForm: FC<PaymentComponentProps> = ({ onDetailsChange, isProcessing }) => {
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Listen for "use test card" events from the TestCardsPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ number: string; brand: string }>).detail;
      if (detail?.number) {
        setCardNumber(formatCardNumber(detail.number));
        // Auto-fill name and expiry for convenience
        if (!cardName) setCardName("Test User");
        if (!cardExpiry) setCardExpiry("12/28");
        if (!cardCvv) setCardCvv("123");
      }
    };
    window.addEventListener("tc:useTestCard", handler);
    return () => window.removeEventListener("tc:useTestCard", handler);
  }, [cardName, cardExpiry, cardCvv]);

  useEffect(() => {
    const digits = cardNumber.replace(/\s/g, "");
    const brand = detectCardBrand(digits);
    const expectedLen = brand === "amex" ? 15 : 16;
    const valid =
      digits.length === expectedLen &&
      cardName.trim().length > 0 &&
      cardExpiry.length >= 5 &&
      cardCvv.length >= 3;

    if (valid) {
      onDetailsChange({
        card_number: digits,
        card_name: cardName.trim(),
        card_last4: digits.slice(-4),
        card_brand: brand,
        card_expiry: cardExpiry,
        card_cvv: cardCvv,
      });
    } else {
      onDetailsChange(null);
    }
  }, [cardNumber, cardName, cardExpiry, cardCvv, onDetailsChange]);

  return (
    <div className="bg-gray-50 rounded-xl p-5 space-y-4 animate-fade-in-up">
      {/* Card preview */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 text-white shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div className="w-10 h-7 rounded bg-yellow-400/80" />
          <span className="text-xs font-mono opacity-70">{cardBrandLabel(detectCardBrand(cardNumber.replace(/\s/g, "")))}</span>
        </div>
        <p className="font-mono text-lg tracking-wider mb-4 min-h-[28px]">
          {cardNumber || "•••• •••• •••• ••••"}
        </p>
        <div className="flex justify-between text-xs">
          <div>
            <p className="opacity-50 uppercase">Card Holder</p>
            <p className="font-medium">{cardName || "YOUR NAME"}</p>
          </div>
          <div>
            <p className="opacity-50 uppercase">Expires</p>
            <p className="font-medium">{cardExpiry || "MM/YY"}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Card Number</label>
        <input
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          className={inputCls}
          placeholder="4242 4242 4242 4242"
          maxLength={detectCardBrand(cardNumber.replace(/\s/g, "")) === "amex" ? 17 : 19}
          inputMode="numeric"
          disabled={isProcessing}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Name on Card</label>
        <input
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          className={inputCls}
          placeholder="John Doe"
          disabled={isProcessing}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Expiry (MM/YY)</label>
          <input
            value={cardExpiry}
            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
            className={inputCls}
            placeholder="12/28"
            maxLength={5}
            disabled={isProcessing}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">CVV</label>
          <input
            value={cardCvv}
            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className={inputCls}
            placeholder="123"
            maxLength={4}
            type="password"
            disabled={isProcessing}
          />
        </div>
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        Test mode — use test cards from the panel below. Different card numbers trigger different scenarios.
      </p>
    </div>
  );
};

export const CardGateway: RegisteredGateway = {
  meta,
  Component: CardGatewayForm,
};

// ---- Helpers ----
const inputCls = "w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand transition disabled:opacity-50";

function formatCardNumber(val: string): string {
  const digits = val.replace(/\D/g, "");
  const brand = detectCardBrand(digits);
  const maxLen = brand === "amex" ? 15 : 16;
  const trimmed = digits.slice(0, maxLen);
  // Amex uses 4-6-5 grouping; others use 4-4-4-4.
  if (brand === "amex") {
    return trimmed.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(" ")).trim();
  }
  return trimmed.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  // Auto-insert the "/" right after the 2nd month digit.
  if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function detectCardBrand(digits: string): string {
  if (digits.startsWith("4")) return "visa";
  if (digits.startsWith("5") || digits.startsWith("2")) return "mastercard";
  if (digits.startsWith("3")) return "amex";
  if (digits.startsWith("6")) return "discover";
  return "card";
}

function cardBrandLabel(brand: string): string {
  const labels: Record<string, string> = {
    visa: "VISA",
    mastercard: "MASTERCARD",
    amex: "AMEX",
    discover: "DISCOVER",
    card: "CARD",
  };
  return labels[brand] || "CARD";
}
