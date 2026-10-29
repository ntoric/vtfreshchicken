"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShoppingCart, ArrowLeft } from "lucide-react";
import { fetchBootstrap, fetchCart, updateCartItem, removeCartItem, clearCart } from "@/lib/api";
import { Header } from "@/components/Header";
import { CartSkeleton } from "@/components/Loaders";
import { formatPrice, getCurrencySymbol } from "@/lib/format";
import { useCurrencyLang } from "@/lib/currency-lang";
import { useToast } from "@/components/Toast";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";

export default function CartPage({ params }: { params: {} }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const qc = useQueryClient();
  const toast = useToast();
  const confirmDlg = useConfirmState();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  const cartQ = useQuery({
    queryKey: ["cart", currency],
    queryFn: () => fetchCart(currency),
    enabled: !!bootstrapQ.data,
  });

  const updateMut = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(itemId, quantity),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart", currency] }),
    onError: (err: Error) => {
      setCartError(err.message);
      toast.error("Cart update failed", err.message);
      setTimeout(() => setCartError(""), 3000);
    },
  });

  const [cartError, setCartError] = useState("");

  const removeMut = useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart", currency] });
      toast.info("Item removed", "The item has been removed from your cart.");
    },
  });

  const clearMut = useMutation({
    mutationFn: () => clearCart(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart", currency] });
      toast.info("Cart cleared", "All items have been removed from your cart.");
    },
  });

  const bootstrap = bootstrapQ.data;
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const cart = cartQ.data?.cart;
  const items = cart?.items ?? [];
  const subtotal = cartQ.data?.subtotal ?? 0;

  if (bootstrapQ.isLoading) {
    return <CartSkeleton />;
  }
  if (!bootstrap) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load store.</div>;
  }

  return (
    <div className="min-h-screen">
      <Header
       
        bootstrap={bootstrap}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Shopping Cart</h1>
        {cartError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
            {cartError}
          </div>
        )}
        <p className="text-gray-500 mb-6 sm:mb-8">
          {items.length === 0 ? "Your cart is empty" : `${items.length} item${items.length > 1 ? "s" : ""} in your cart`}
        </p>

        {cartQ.isLoading ? (
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border p-6 h-28" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 sm:p-12 text-center">
            <div className="flex justify-center mb-4">
              <ShoppingCart className="w-16 h-16 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-medium text-gray-900 mb-2">Your cart is empty</p>
            <p className="text-gray-500 mb-6">Browse our products and add something you like.</p>
            <Link
              href={``}
              className="inline-flex items-center gap-1.5 bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition"
            >
              <ArrowLeft className="w-4 h-4" /> Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Items */}
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl border p-3 sm:p-4 flex gap-3 sm:gap-4">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.image_url && (
                      <Image src={item.image_url} alt={item.product_name} fill sizes="96px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-2">{item.product_name}</p>
                        {item.variant_name && (
                          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{item.variant_name}</p>
                        )}
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">{formatPrice(item.unit_price, currencyObj)} each</p>
                      </div>
                      <button
                        onClick={() => confirmDlg.open({ message: `Remove "${item.product_name}" from your cart?`, variant: "danger", confirmLabel: "Remove", onConfirm: () => removeMut.mutate(item.id) })}
                        className="text-rose-500 hover:text-rose-600 text-sm flex items-center gap-1 flex-shrink-0"
                        aria-label="Remove item"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3 gap-2">
                      <div className="flex items-center border rounded-lg">
                        <button
                          onClick={() => updateMut.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                          className="px-3 py-1.5 text-gray-500 hover:text-gray-900"
                        >−</button>
                        <span className="px-3 py-1.5 font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateMut.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                          className="px-3 py-1.5 text-gray-500 hover:text-gray-900"
                        >+</button>
                      </div>
                      <p className="font-bold text-gray-900 text-sm sm:text-base">{formatPrice(item.line_total, currencyObj)}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-between pt-2">
                <Link href={``} className="text-brand font-medium hover:underline text-sm inline-flex items-center gap-1.5">
                  <ArrowLeft className="w-4 h-4" /> Continue shopping
                </Link>
                <button
                  onClick={() => confirmDlg.open({ message: "Clear all items from your cart?", variant: "danger", confirmLabel: "Clear cart", onConfirm: () => clearMut.mutate() })}
                  className="text-rose-500 hover:underline text-sm"
                >
                  Clear cart
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="lg:sticky lg:top-28 h-fit">
              <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-4">
                <h2 className="font-bold text-gray-900 text-lg">Order Summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatPrice(subtotal, currencyObj)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="text-gray-400">Calculated at checkout</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="text-gray-400">Calculated at checkout</span>
                  </div>
                </div>
                <div className="border-t pt-4 flex justify-between items-baseline">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">{formatPrice(subtotal, currencyObj)}</span>
                </div>
                <button
                  onClick={() => window.location.href = `/checkout`}
                  className="w-full bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition shadow-md"
                >
                  Proceed to Checkout
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Secure checkout{bootstrapQ.data?.modules?.returns !== false && bootstrapQ.data?.settings?.returns_enabled !== false ? ` · Free returns within ${bootstrapQ.data?.settings?.return_period_days || 30} days` : ""}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog {...confirmDlg.props} />
    </div>
  );
}
