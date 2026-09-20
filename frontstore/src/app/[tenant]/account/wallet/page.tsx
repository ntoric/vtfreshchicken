"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, Plus, History, CreditCard } from "lucide-react";
import { fetchBootstrap, getStoredCustomer, getAuthToken, getWallet, topUpWallet, listWalletTransactions, fetchPaymentMethods, generateIdempotencyKey } from "@/lib/api";
import { getGateway } from "@/lib/paymentRegistry";
import { Header } from "@/components/Header";
import { StorefrontSkeleton } from "@/components/Loaders";
import { useCurrencyLang } from "@/lib/currency-lang";
import { useToast } from "@/components/Toast";
import type { PaymentGatewayInfo, PaymentDetails } from "@/types";

const PRESET_AMOUNTS = [10, 25, 50, 100, 200];

export default function WalletPage({ params }: { params: { tenant: string } }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [authed, setAuthed] = useState(false);
  const [topupAmount, setTopupAmount] = useState(50);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVV, setCardCVV] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const topupIdemKeyRef = useRef("");

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap", params.tenant],
    queryFn: () => fetchBootstrap(params.tenant),
  });

  const walletQ = useQuery({
    queryKey: ["wallet", params.tenant],
    queryFn: () => getWallet(params.tenant),
    enabled: authed,
  });

  const txnsQ = useQuery({
    queryKey: ["wallet-transactions", params.tenant],
    queryFn: () => listWalletTransactions(params.tenant, 50, 0),
    enabled: authed,
  });

  const methodsQ = useQuery({
    queryKey: ["payment-methods", params.tenant],
    queryFn: () => fetchPaymentMethods(params.tenant),
    enabled: authed,
  });

  useEffect(() => {
    setAuthed(!!getAuthToken());
  }, []);

  // Auto-select first non-wallet payment method
  useEffect(() => {
    if (!selectedMethod && methodsQ.data?.methods?.length) {
      const first = methodsQ.data.methods.find((m: PaymentGatewayInfo) => m.id !== "wallet");
      if (first) setSelectedMethod(first.id);
    }
  }, [methodsQ.data, selectedMethod]);

  const topupMut = useMutation({
    mutationFn: () => {
      const details: PaymentDetails = {};
      if (selectedMethod === "card") {
        details.card_number = cardNumber;
        details.card_name = cardName;
        details.card_expiry = cardExpiry;
        details.card_cvv = cardCVV;
      } else if (selectedMethod === "paypal") {
        details.paypal_email = paypalEmail;
      }
      if (!topupIdemKeyRef.current) {
        topupIdemKeyRef.current = generateIdempotencyKey();
      }
      return topUpWallet(params.tenant, {
        amount: topupAmount,
        payment_method: selectedMethod,
        payment_details: details,
        currency_code: currency,
      }, topupIdemKeyRef.current);
    },
    onSuccess: () => {
      topupIdemKeyRef.current = "";
      toast.success("Wallet topped up!", `$${topupAmount} has been added to your wallet.`);
      qc.invalidateQueries({ queryKey: ["wallet", params.tenant] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions", params.tenant] });
      setCardNumber(""); setCardName(""); setCardExpiry(""); setCardCVV(""); setPaypalEmail("");
    },
    onError: (e: Error) => {
      toast.error("Top-up failed", e.message);
    },
  });

  if (bootstrapQ.isLoading) return <StorefrontSkeleton />;
  if (bootstrapQ.error || !bootstrapQ.data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500">
        Failed to load. Please try again.
      </div>
    );
  }

  const settings = bootstrapQ.data.settings;
  const customer = getStoredCustomer();
  const brandColor = settings?.brand_color || "#4f46e5";

  if (!authed) {
    return (
      <>
        <Header tenant={params.tenant} bootstrap={bootstrapQ.data} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border p-8 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: brandColor }}>
              <WalletIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">My Wallet</h1>
            <p className="text-slate-500 mb-6">Please log in to view your wallet balance and transactions.</p>
            <Link
              href={`/${params.tenant}/account/login?redirect=${encodeURIComponent(`/${params.tenant}/account/wallet`)}`}
              className="inline-block px-5 py-2 rounded-lg text-white font-medium hover:opacity-90 transition"
              style={{ background: brandColor }}
            >
              Log In
            </Link>
          </div>
        </div>
      </>
    );
  }

  const wallet = walletQ.data;
  const transactions = txnsQ.data?.items ?? [];
  const availableMethods = (methodsQ.data?.methods ?? []).filter((m: PaymentGatewayInfo) => m.id !== "wallet" && m.id !== "cod");

  return (
    <>
      <Header tenant={params.tenant} bootstrap={bootstrapQ.data} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
            <Link href={`/${params.tenant}`} className="hover:text-slate-900">Home</Link>
            <span>/</span>
            <Link href={`/${params.tenant}/account/dashboard`} className="hover:text-slate-900">Account</Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Wallet</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <WalletIcon className="w-7 h-7" style={{ color: brandColor }} />
            My Wallet
          </h1>

          {/* Balance Card */}
          <div
            className="rounded-3xl p-8 mb-8 text-white shadow-xl relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
          >
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10" style={{ background: "white", transform: "translate(30%, -30%)" }} />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10" style={{ background: "white", transform: "translate(-30%, 30%)" }} />
            <div className="relative">
              <p className="text-white/80 text-sm font-medium mb-2">Current Balance</p>
              {walletQ.isLoading ? (
                <div className="h-10 w-40 bg-white/20 rounded-lg animate-pulse" />
              ) : walletQ.error ? (
                <p className="text-white/80">Failed to load balance</p>
              ) : (
                <p className="text-4xl font-bold">
                  {wallet?.currency_code || "USD"}{" "}
                  {(wallet?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              <div className="mt-4 flex items-center gap-4 text-sm text-white/80">
                <span className="flex items-center gap-1">
                  <ArrowDownCircle className="w-4 h-4" /> Top up to add money
                </span>
                <span className="flex items-center gap-1">
                  <ArrowUpCircle className="w-4 h-4" /> Use at checkout
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Up Card */}
            <div className="bg-white rounded-2xl border p-6">
              <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" style={{ color: brandColor }} />
                Add Money
              </h2>

              {/* Preset amounts */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    className={`py-2 rounded-lg text-sm font-medium border transition ${
                      topupAmount === amt
                        ? "text-white border-transparent"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                    style={topupAmount === amt ? { background: brandColor } : {}}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="mb-4">
                <label className="text-sm text-slate-500 block mb-1">Or enter custom amount</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-lg">$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(Number(e.target.value))}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Payment method selection */}
              <div className="mb-4">
                <label className="text-sm text-slate-500 block mb-2">Payment Method</label>
                {methodsQ.isLoading ? (
                  <p className="text-sm text-slate-400">Loading payment methods…</p>
                ) : availableMethods.length === 0 ? (
                  <p className="text-sm text-slate-400">No payment methods available.</p>
                ) : (
                  <div className="space-y-2">
                    {availableMethods.map((m: PaymentGatewayInfo) => {
                      const gw = getGateway(m.id);
                      const Icon = gw?.meta.icon ?? CreditCard;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMethod(m.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                            selectedMethod === m.id
                              ? "border-2"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                          style={selectedMethod === m.id ? { borderColor: brandColor } : {}}
                        >
                          <Icon className="w-6 h-6 text-slate-700 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{m.name}</p>
                            <p className="text-xs text-slate-400">{m.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Card fields (for card method) */}
              {selectedMethod === "card" && (
                <div className="space-y-3 mb-4">
                  <input
                    placeholder="Card number"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <input
                    placeholder="Name on card"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <input
                      placeholder="CVV"
                      type="password"
                      value={cardCVV}
                      onChange={(e) => setCardCVV(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>
              )}

              {/* PayPal fields */}
              {selectedMethod === "paypal" && (
                <div className="space-y-3 mb-4">
                  <input
                    placeholder="PayPal email"
                    type="email"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              )}

              <button
                onClick={() => topupMut.mutate()}
                disabled={topupMut.isPending || topupAmount <= 0 || !selectedMethod}
                className="w-full py-2.5 rounded-lg text-white font-medium disabled:opacity-50 transition hover:opacity-90"
                style={{ background: brandColor }}
              >
                {topupMut.isPending ? "Processing…" : `Add $${topupAmount} to Wallet`}
              </button>
            </div>

            {/* Transaction History */}
            <div className="bg-white rounded-2xl border p-6">
              <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <History className="w-5 h-5" style={{ color: brandColor }} />
                Transaction History
              </h2>
              {txnsQ.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : txnsQ.error ? (
                <p className="text-sm text-rose-500">Failed to load transactions.</p>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <WalletIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No transactions yet.</p>
                  <p className="text-xs">Top up your wallet to get started.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {transactions.map((txn) => {
                    const isCredit = txn.type === "credit";
                    return (
                      <div key={txn.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isCredit ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)",
                          }}
                        >
                          {isCredit ? (
                            <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <ArrowUpCircle className="w-5 h-5 text-rose-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {txn.description || txn.source}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(txn.created_at).toLocaleDateString()}{" "}
                            {new Date(txn.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {txn.reference && ` · Ref: ${txn.reference.slice(0, 20)}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p
                            className="text-sm font-bold"
                            style={{ color: isCredit ? "#10b981" : "#f43f5e" }}
                          >
                            {isCredit ? "+" : "−"}{txn.currency_code}{" "}
                            {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-slate-400">
                            Bal: {txn.currency_code} {txn.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
