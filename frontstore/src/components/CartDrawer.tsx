"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { InlineLoader } from "@/components/Loaders";
import { useConfirmState, ConfirmDialog } from "@/components/ConfirmDialog";
import { formatPrice } from "@/lib/format";
import type { Currency } from "@/types";

export function CartDrawer({ currency }: { currency?: Currency }) {
  const { cart, isOpen, closeCart, updateItem, removeItem, isLoading } = useCart();
  const router = useRouter();
  const confirmDlg = useConfirmState();

  if (!isOpen) return null;

  const items = cart?.cart.items ?? [];
  const subtotal = cart?.subtotal ?? 0;

  const handleCheckout = () => {
    closeCart();
    router.push(`/checkout`);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 transition-opacity"
        onClick={closeCart}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col animate-slide-in pt-safe pb-safe">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">
            Your Cart {items.length > 0 && `(${items.length})`}
          </h2>
          <button
            onClick={closeCart}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label="Close cart"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1"><InlineLoader label="Loading cart" /></div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.484M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            <p className="text-lg font-medium">Your cart is empty</p>
            <Link
              href={``}
              onClick={closeCart}
              className="mt-1 inline-flex items-center gap-1.5 bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition"
            >
              <ArrowRight className="w-4 h-4" /> Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.image_url && (
                      <Image src={item.image_url} alt={item.product_name} fill sizes="80px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm line-clamp-2">{item.product_name}</p>
                    {item.variant_name && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.variant_name}</p>
                    )}
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {formatPrice(item.unit_price, currency)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center border rounded-lg text-sm">
                        <button
                          onClick={() => updateItem(item.id, item.quantity - 1)}
                          className="px-2 py-1 text-gray-500 hover:text-gray-900"
                        >−</button>
                        <span className="px-2 py-1 font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateItem(item.id, item.quantity + 1)}
                          className="px-2 py-1 text-gray-500 hover:text-gray-900"
                        >+</button>
                      </div>
                      <button
                        onClick={() => confirmDlg.open({ message: `Remove "${item.product_name}" from your cart?`, variant: "danger", confirmLabel: "Remove", onConfirm: () => removeItem(item.id) })}
                        className="text-xs text-rose-500 hover:underline"
                      >Remove</button>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 text-sm">
                      {formatPrice(item.line_total, currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-xl font-bold text-gray-900">{formatPrice(subtotal, currency)}</span>
              </div>
              <p className="text-xs text-gray-400">Shipping and taxes calculated at checkout.</p>
              <div className="flex gap-3">
                <Link
                  href={`/cart`}
                  onClick={closeCart}
                  className="flex-1 text-center border border-gray-300 rounded-xl py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  View Cart
                </Link>
                <button
                  onClick={handleCheckout}
                  className="flex-1 bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition"
                >
                  Checkout
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <ConfirmDialog {...confirmDlg.props} />
    </>
  );
}
