"use client";

import { useState } from "react";
import {
  Check,
  X,
  Clock,
  AlertTriangle,
  Lock,
  Ban,
  Hourglass,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TestCard, TestScenario } from "@/types";

interface TestCardsPanelProps {
  cards: TestCard[];
  onUseCard: (card: TestCard) => void;
}

const scenarioColors: Record<TestScenario, string> = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  declined: "bg-rose-100 text-rose-700 border-rose-200",
  insufficient_funds: "bg-rose-100 text-rose-700 border-rose-200",
  expired_card: "bg-amber-100 text-amber-700 border-amber-200",
  incorrect_cvc: "bg-amber-100 text-amber-700 border-amber-200",
  processing_error: "bg-rose-100 text-rose-700 border-rose-200",
  "3ds_challenge": "bg-indigo-100 text-indigo-700 border-indigo-200",
  fraud_blocked: "bg-rose-100 text-rose-700 border-rose-200",
  slow_approval: "bg-sky-100 text-sky-700 border-sky-200",
  refund: "bg-purple-100 text-purple-700 border-purple-200",
};

const scenarioIcons: Record<TestScenario, LucideIcon> = {
  success: Check,
  declined: X,
  insufficient_funds: X,
  expired_card: Clock,
  incorrect_cvc: X,
  processing_error: AlertTriangle,
  "3ds_challenge": Lock,
  fraud_blocked: Ban,
  slow_approval: Hourglass,
  refund: Undo2,
};

const brandColors: Record<string, string> = {
  visa: "bg-blue-600",
  mastercard: "bg-orange-500",
  amex: "bg-cyan-600",
  discover: "bg-orange-600",
};

export function TestCardsPanel({ cards, onUseCard }: TestCardsPanelProps) {
  const [filter, setFilter] = useState<"all" | "success" | "failure">("all");

  const filtered = cards.filter((c) => {
    if (filter === "all") return true;
    if (filter === "success") return c.expected_result === "paid";
    return c.expected_result === "failed";
  });

  return (
    <div className="bg-white rounded-2xl border-2 border-amber-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
          <h3 className="font-bold text-sm">Test Cards</h3>
        </div>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{filtered.length} cards</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-5 py-2 bg-amber-50 border-b border-amber-100">
        {(["all", "success", "failure"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1 rounded-full transition ${
              filter === f
                ? "bg-amber-500 text-white"
                : "bg-white text-amber-700 hover:bg-amber-100"
            }`}
          >
            {f === "all" ? "All" : f === "success" ? "Success" : "Failures"}
          </button>
        ))}
      </div>

      {/* Cards list */}
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
        {filtered.map((card) => (
          <div
            key={card.number}
            className="px-5 py-3 hover:bg-amber-50/50 transition flex items-center gap-3 group"
          >
            {/* Brand badge */}
            <div className={`w-10 h-7 rounded ${brandColors[card.brand] || "bg-gray-600"} text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 uppercase`}>
              {card.brand.slice(0, 4)}
            </div>

            {/* Card info */}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-gray-700 truncate">
                {card.number.replace(/(.{4})/g, "$1 ").trim()}
              </p>
              <p className="text-xs text-gray-500 truncate">{card.description}</p>
            </div>

            {/* Scenario badge */}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 inline-flex items-center gap-1 ${scenarioColors[card.scenario]}`}>
              {(() => { const SIcon = scenarioIcons[card.scenario]; return <SIcon className="w-3 h-3" strokeWidth={2.5} />; })()}
              {card.scenario.replace(/_/g, " ")}
            </span>

            {/* Use button */}
            <button
              onClick={() => onUseCard(card)}
              className="text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition flex-shrink-0 opacity-0 group-hover:opacity-100"
              title="Fill card number into the form"
            >
              Use
            </button>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-2 bg-amber-50 border-t border-amber-100">
        <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          Click "Use" to fill the card number. Use any future expiry and any 3-digit CVV.
        </p>
      </div>
    </div>
  );
}

export function TestModeBanner() {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl px-4 py-2.5 mb-6 flex items-center gap-3 shadow-md">
      <svg className="w-5 h-5 flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-semibold">Test Payment Mode Active</p>
        <p className="text-xs text-white/80">No real payments will be processed. Use test cards to simulate different payment scenarios.</p>
      </div>
    </div>
  );
}
