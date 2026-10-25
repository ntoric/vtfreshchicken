"use client";

import { useEffect, FC } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ArrowRight } from "lucide-react";
import type { PaymentGatewayMeta, PaymentComponentProps, RegisteredGateway } from "@/lib/paymentRegistry";
import { getWallet } from "@/lib/api";

const meta: PaymentGatewayMeta = {
  id: "wallet",
  name: "Store Wallet",
  description: "Pay using your wallet balance",
  icon: Wallet,
  group: "wallet",
};

const WalletGatewayForm: FC<PaymentComponentProps> = ({ amount, currencySymbol, onDetailsChange }) => {
  const walletQ = useQuery({
    queryKey: ["wallet"],
    queryFn: () => getWallet(),
  });

  const balance = walletQ.data?.balance ?? 0;
  const sufficient = balance >= amount;

  // Wallet payment needs no extra details — just signal validity based on balance
  useEffect(() => {
    if (sufficient && !walletQ.isLoading) {
      onDetailsChange({});
    } else {
      onDetailsChange(null);
    }
  }, [sufficient, walletQ.isLoading, onDetailsChange]);

  if (walletQ.isLoading) {
    return (
      <div className="bg-indigo-50 rounded-xl p-5 animate-pulse">
        <div className="h-6 w-40 bg-indigo-100 rounded" />
      </div>
    );
  }

  if (walletQ.error) {
    return (
      <div className="bg-amber-50 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Wallet className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-medium text-gray-900">Wallet unavailable</p>
            <p className="text-xs text-gray-500">
              Could not load your wallet balance. Please log in or choose another payment method.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-5 space-y-3 animate-fade-in-up ${sufficient ? "bg-indigo-50" : "bg-rose-50"}`}>
      <div className="flex items-start gap-3">
        <Wallet className={`w-6 h-6 flex-shrink-0 mt-0.5 ${sufficient ? "text-indigo-600" : "text-rose-600"}`} />
        <div className="text-sm text-gray-700 space-y-1 flex-1">
          <p className="font-medium text-gray-900">Store Wallet</p>
          {sufficient ? (
            <>
              <p>
                Your wallet balance:{" "}
                <span className="font-semibold text-indigo-700">
                  {currencySymbol}{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {currencySymbol}{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                will be deducted from your wallet. Remaining balance after payment:{" "}
                <span className="font-medium">
                  {currencySymbol}{(balance - amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
            </>
          ) : (
            <>
              <p>
                Your wallet balance:{" "}
                <span className="font-semibold text-rose-700">
                  {currencySymbol}{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
              <p className="text-rose-600 text-xs">
                Insufficient balance. You need{" "}
                {currencySymbol}{(amount - balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                more. Please top up your wallet or choose another payment method.
              </p>
              <a
                href={`/account/wallet`}
                className="inline-flex items-center gap-1 mt-2 text-indigo-600 hover:underline text-xs font-medium"
              >
                <ArrowRight className="w-3 h-3" /> Top up your wallet
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const WalletGateway: RegisteredGateway = {
  meta,
  Component: WalletGatewayForm,
};
