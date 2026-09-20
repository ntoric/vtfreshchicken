"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { CreditCard, ShoppingCart, AlertTriangle, Check, X } from "lucide-react";
import { fetchBootstrap, fetchCart, fetchPaymentMethods, fetchTestCards, fetchTestTransactions, clearTestTransactions, placeOrder, calculateTax, calculateShipping, validateDiscountCode, generateIdempotencyKey } from "@/lib/api";
import { getGateway } from "@/lib/paymentRegistry";
import { Header } from "@/components/Header";
import { FullPageLoader } from "@/components/Loaders";
import { TestModeBanner, TestCardsPanel } from "@/components/payment/TestCardsPanel";
import { formatPrice, getCurrencySymbol } from "@/lib/format";
import type { AddressInput, CheckoutRequest, PaymentDetails, PaymentGatewayInfo, TestCard } from "@/types";
import { useCurrencyLang } from "@/lib/currency-lang";
import { useAuth } from "@/lib/auth";

// Session storage key for passing checkout context between pages
const CHECKOUT_CTX_KEY = "tc_checkout_ctx";
// Session storage key for passing order response to status pages
const ORDER_CTX_KEY = "tc_order_response";

interface CheckoutContext {
  shipping_address: AddressInput;
  billing_address?: AddressInput;
  same_as_billing?: boolean;
  has_shippable_items?: boolean;
  shipping_method: string;
  discount_code?: string;
  notes?: string;
  currency: string;
  item_shipping_methods?: { cart_item_index: number; method_code: string }[];
}

export default function PaymentPage({ params }: { params: { tenant: string } }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const { isAuthenticated } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [error, setError] = useState("");
  const [ctx, setCtx] = useState<CheckoutContext | null>(null);

  // Load checkout context from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHECKOUT_CTX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CheckoutContext;
        setCtx(parsed);
        if (parsed.currency) setCurrency(parsed.currency);
      }
    } catch {
      // ignore
    }
  }, []);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap", params.tenant],
    queryFn: () => fetchBootstrap(params.tenant),
  });

  const cartQ = useQuery({
    queryKey: ["cart", params.tenant, currency],
    queryFn: () => fetchCart(params.tenant, currency),
    enabled: !!bootstrapQ.data,
  });

  const methodsQ = useQuery({
    queryKey: ["payment-methods", params.tenant],
    queryFn: () => fetchPaymentMethods(params.tenant),
    enabled: !!bootstrapQ.data,
  });

  const isTestMode = methodsQ.data?.test_mode ?? false;

  // Fetch test cards (only in test mode)
  const testCardsQ = useQuery({
    queryKey: ["test-cards", params.tenant],
    queryFn: () => fetchTestCards(params.tenant),
    enabled: isTestMode && !!bootstrapQ.data,
  });

  // Fetch test transactions (only in test mode, refetched after payment)
  const testTxsQ = useQuery({
    queryKey: ["test-transactions", params.tenant],
    queryFn: () => fetchTestTransactions(params.tenant),
    enabled: isTestMode && !!bootstrapQ.data,
  });

  const bootstrap = bootstrapQ.data;
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const cart = cartQ.data?.cart;
  const items = cart?.items ?? [];
  const subtotal = cartQ.data?.subtotal ?? 0;

  // Calculate shipping from server using the shipping address from checkout context
  const shippingQ = useQuery({
    queryKey: ["shipping", params.tenant, ctx?.shipping_address.country, ctx?.shipping_address.state, subtotal],
    queryFn: () => calculateShipping(
      params.tenant,
      subtotal,
      {
        line1: ctx?.shipping_address.line1 || "",
        city: ctx?.shipping_address.city || "",
        state: ctx?.shipping_address.state,
        postal_code: ctx?.shipping_address.postal_code,
        country: ctx?.shipping_address.country || "",
      },
      ctx?.currency || "USD",
    ),
    enabled: !!ctx?.shipping_address?.country && !!cart && (cart?.items?.length ?? 0) > 0,
    staleTime: 30000,
  });

  const shippingOptions = shippingQ.data?.options ?? [];
  const selectedShippingOption = shippingOptions.find(o => o.code === ctx?.shipping_method);
  const fallbackShippingCost = useMemo(() => {
    const method = ctx?.shipping_method || "standard";
    if (method === "express") return 15;
    return subtotal >= 50 ? 0 : 5.99;
  }, [ctx, subtotal]);
  const shippingCost = selectedShippingOption ? selectedShippingOption.rate : fallbackShippingCost;

  // Calculate tax from server using the shipping address from checkout context
  const taxQ = useQuery({
    queryKey: ["tax", params.tenant, ctx?.shipping_address.country, ctx?.shipping_address.state, shippingCost, subtotal, cart?.items?.map(i => `${i.id}:${i.quantity}`).join(",")],
    queryFn: () => calculateTax(
      params.tenant,
      (cart?.items ?? []).map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: i.line_total,
        tax_class_id: i.tax_class_id,
      })),
      {
        line1: ctx?.shipping_address.line1 || "",
        city: ctx?.shipping_address.city || "",
        state: ctx?.shipping_address.state,
        postal_code: ctx?.shipping_address.postal_code,
        country: ctx?.shipping_address.country || "",
      },
      shippingCost,
    ),
    enabled: !!ctx?.shipping_address?.country && !!cart && (cart?.items?.length ?? 0) > 0,
    staleTime: 30000,
  });

  const tax = taxQ.data?.tax_total ?? 0;
  const taxBreakdown = taxQ.data?.breakdown ?? [];

  // Validate discount code if present in context
  const discountQ = useQuery({
    queryKey: ["discount-validate", params.tenant, ctx?.discount_code, subtotal],
    queryFn: () => validateDiscountCode(params.tenant, ctx?.discount_code || "", subtotal),
    enabled: !!ctx?.discount_code && subtotal > 0,
    staleTime: 30000,
  });
  const discountAmount = discountQ.data?.valid ? (discountQ.data.discount || 0) : 0;

  const total = subtotal - discountAmount + shippingCost + tax;

  // Auto-select first available method
  useEffect(() => {
    const all = methodsQ.data?.methods ?? [];
    // Wallet payment requires an authenticated customer account; hide it for
    // anonymous/guest checkout so the wallet form (which calls the auth-only
    // wallet API) is never shown to unauthenticated users.
    const visible = isAuthenticated ? all : all.filter((m) => m.id !== "wallet");
    if (!selectedMethod && visible.length) {
      setSelectedMethod(visible[0].id);
    }
    // If the selected method is no longer visible (e.g. wallet after logout),
    // reset the selection so an invalid method isn't kept.
    if (selectedMethod && !visible.some((m) => m.id === selectedMethod)) {
      setSelectedMethod(visible.length ? visible[0].id : null);
      setPaymentDetails(null);
    }
  }, [methodsQ.data, selectedMethod, isAuthenticated]);

  // Cache payment methods for gateway components to read public_config (e.g. Razorpay key_id)
  useEffect(() => {
    if (methodsQ.data?.methods) {
      (window as unknown as { __tcPaymentMethods?: { methods: typeof methodsQ.data.methods } }).__tcPaymentMethods = methodsQ.data;
    }
  }, [methodsQ.data]);

  const idemKeyRef = useRef<string>("");

  const placeOrderMut = useMutation({
    mutationFn: (req: CheckoutRequest) => placeOrder(params.tenant, req, idemKeyRef.current || undefined),
    onSuccess: (res) => {
      idemKeyRef.current = "";
      sessionStorage.removeItem(CHECKOUT_CTX_KEY);
      // Store the full order response for the status page to read
      sessionStorage.setItem(ORDER_CTX_KEY, JSON.stringify(res));
      // Immediately remove cart queries from cache so the UI shows an empty cart
      // without waiting for a refetch (the backend has already cleared the cart).
      qc.removeQueries({ queryKey: ["cart"] });
      qc.removeQueries({ queryKey: ["cart-count"] });
      // Redirect based on order status
      const status = res.order.status;
      if (status === "paid") {
        router.push(`/${params.tenant}/checkout/success?orderId=${res.order.id}`);
      } else if (status === "pending") {
        router.push(`/${params.tenant}/checkout/pending?orderId=${res.order.id}`);
      } else {
        // Fallback for any other status
        router.push(`/${params.tenant}/checkout/success?orderId=${res.order.id}`);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
      // Redirect to the failed page with the error message
      // Store the error in sessionStorage since query params have length limits
      sessionStorage.setItem("tc_payment_error", err.message);
      router.push(`/${params.tenant}/checkout/failed?error=${encodeURIComponent(err.message.slice(0, 200))}`);
      // Refetch test transactions so the failed attempt shows up in the log
      if (isTestMode) {
        setTimeout(() => testTxsQ.refetch(), 500);
      }
    },
  });

  // Handle "use test card" from the TestCardsPanel — dispatch a custom event
  // that the CardGateway component listens for
  const handleUseTestCard = useCallback((card: TestCard) => {
    // Switch to card gateway if not already selected
    if (selectedMethod !== "card") {
      setSelectedMethod("card");
    }
    // Dispatch event for CardGateway to pick up
    window.dispatchEvent(new CustomEvent("tc:useTestCard", {
      detail: { number: card.number, brand: card.brand },
    }));
  }, [selectedMethod]);

  const handleClearTestTxs = useCallback(async () => {
    await clearTestTransactions(params.tenant);
    testTxsQ.refetch();
  }, [params.tenant, testTxsQ]);

  const handlePay = useCallback(() => {
    if (!ctx) {
      setError("Missing checkout information. Please go back to checkout.");
      return;
    }
    if (!selectedMethod) {
      setError("Please select a payment method.");
      return;
    }
    if (!paymentDetails) {
      setError("Please complete the payment form.");
      return;
    }

    setError("");
    // Generate a fresh idempotency key for each new checkout attempt.
    // Reused across retries of the same attempt to prevent double orders.
    if (!idemKeyRef.current) {
      idemKeyRef.current = generateIdempotencyKey();
    }
    const req: CheckoutRequest = {
      shipping_address: ctx.shipping_address,
      billing_address: ctx.billing_address,
      payment_method: selectedMethod,
      payment_details: paymentDetails,
      currency_code: currency,
      discount_code: ctx.discount_code,
      shipping_method: ctx.shipping_method,
      notes: ctx.notes,
      item_shipping_methods: ctx.item_shipping_methods,
    };
    placeOrderMut.mutate(req);
  }, [ctx, selectedMethod, paymentDetails, currency, placeOrderMut]);

  // ---- Loading & error states ----
  if (bootstrapQ.isLoading) {
    return <FullPageLoader label="Loading payment" />;
  }
  if (!bootstrap) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load store.</div>;
  }

  if (!ctx) {
    return (
      <div className="min-h-screen">
        <Header tenant={params.tenant} bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="w-16 h-16 text-amber-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Checkout Information</h1>
          <p className="text-gray-500 mb-6">Please complete the shipping and billing steps first.</p>
          <Link href={`/${params.tenant}/checkout`} className="inline-block bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition">
            Go to Checkout
          </Link>
        </div>
      </div>
    );
  }

  if (cartQ.isLoading) {
    return (
      <div className="min-h-screen">
        <Header tenant={params.tenant} bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <FullPageLoader label="Loading your order" />
        </div>
      </div>
    );
  }

  if (items.length === 0 && !placeOrderMut.isSuccess) {
    return (
      <div className="min-h-screen">
        <Header tenant={params.tenant} bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="flex justify-center mb-4">
            <ShoppingCart className="w-16 h-16 text-gray-300" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-500 mb-6">Add items to your cart before checking out.</p>
          <Link href={`/${params.tenant}`} className="inline-block bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  // Wallet payment requires an authenticated customer account; hide it for
  // anonymous/guest checkout.
  const availableMethods = (methodsQ.data?.methods ?? []).filter(
    (m) => isAuthenticated || m.id !== "wallet",
  );
  const selectedGateway = selectedMethod ? getGateway(selectedMethod) : null;
  const SelectedForm = selectedGateway?.Component;

  return (
    <div className="min-h-screen">
      <Header tenant={params.tenant} bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
          <Link href={`/${params.tenant}`} className="hover:text-brand whitespace-nowrap">Home</Link>
          <span>/</span>
          <Link href={`/${params.tenant}/cart`} className="hover:text-brand whitespace-nowrap">Cart</Link>
          <span>/</span>
          <Link href={`/${params.tenant}/checkout`} className="hover:text-brand whitespace-nowrap">Checkout</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium whitespace-nowrap">Payment</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Payment</h1>
        <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8">Choose your preferred payment method and complete your purchase.</p>

        {isTestMode && <TestModeBanner />}

        {error && (
          <div className="bg-rose-50 text-rose-600 rounded-xl px-4 py-3 mb-6 text-sm font-medium flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8">
          {/* Payment methods + form */}
          <div className="space-y-5">
            {/* Gateway selector */}
            <div className="bg-white rounded-2xl border p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                </svg>
                Select Payment Method
              </h2>

              {methodsQ.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl shimmer bg-gray-100" />
                  ))}
                </div>
              ) : availableMethods.length === 0 ? (
                <p className="text-gray-500 text-sm">No payment methods available.</p>
              ) : (
                <div className="space-y-3">
                  {availableMethods.map((method: PaymentGatewayInfo) => {
                    const gw = getGateway(method.id);
                    const isSelected = selectedMethod === method.id;
                    return (
                      <div
                        key={method.id}
                        onClick={() => { setSelectedMethod(method.id); setPaymentDetails(null); setError(""); }}
                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition ${
                          isSelected ? "border-brand bg-brand-light ring-1 ring-brand" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "border-brand" : "border-gray-300"
                        }`}>
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                        </div>
                        <span className="text-2xl flex-shrink-0">
                          {(() => {
                            const IconCmp = gw?.meta.icon;
                            if (IconCmp) {
                              const Icon = IconCmp;
                              return <Icon className="w-6 h-6 text-gray-700" />;
                            }
                            return <CreditCard className="w-6 h-6 text-gray-700" />;
                          })()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{gw?.meta.name || method.name}</p>
                          <p className="text-xs text-gray-500">{gw?.meta.description || method.description}</p>
                        </div>
                        {method.requires_redirect && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">Redirect</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected gateway form */}
            {SelectedForm && selectedMethod && (
              <div className="bg-white rounded-2xl border p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                  {selectedGateway?.meta.name} Details
                </h2>
                <SelectedForm
                  amount={total}
                  currencySymbol={currencyObj?.symbol || "$"}
                  onDetailsChange={setPaymentDetails}
                  isProcessing={placeOrderMut.isPending}
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2 gap-3">
              <Link
                href={`/${params.tenant}/checkout`}
                className="flex items-center gap-1.5 text-gray-600 font-medium hover:text-gray-900 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                <span className="hidden sm:inline">Back to Checkout</span>
                <span className="sm:hidden">Back</span>
              </Link>

              <button
                onClick={handlePay}
                disabled={placeOrderMut.isPending || !paymentDetails || !selectedMethod}
                className="bg-emerald-600 text-white font-semibold px-4 sm:px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {placeOrderMut.isPending ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M16.023 9.348h4.992M2.985 19.644v-4.992M19.644 2.985l-3.232 3.232M5.376 18.624l3.232-3.232M9.348 16.023v4.992M19.644 2.985H14.652M2.985 14.652V9.348" />
                    </svg>
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                    </svg>
                    Pay {formatPrice(total, currencyObj)}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Order summary sidebar */}
          <div className="lg:sticky lg:top-28 h-fit">
            <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-lg">Order Summary</h2>

              {/* Address preview */}
              <div className="bg-gray-50 rounded-xl p-3 text-xs">
                <p className="font-medium text-gray-700 mb-1">
                  {ctx.has_shippable_items === false ? "Billing To" : "Shipping To"}
                </p>
                <p className="text-gray-600">
                  {ctx.shipping_address.first_name} {ctx.shipping_address.last_name}
                </p>
                <p className="text-gray-600">{ctx.shipping_address.line1}</p>
                <p className="text-gray-600">
                  {ctx.shipping_address.city}, {ctx.shipping_address.state} {ctx.shipping_address.postal_code}
                </p>
                <p className="text-gray-600">{ctx.shipping_address.country}</p>
                <Link href={`/${params.tenant}/checkout`} className="text-brand hover:underline mt-1 inline-block">Edit</Link>
              </div>

              {/* Items */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative">
                      {item.image_url && <img src={item.image_url} alt="" className="w-full h-full object-cover" />}
                      <span className="absolute -top-1 -right-1 bg-gray-700 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{item.quantity}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-xs">{item.product_name}</p>
                    </div>
                    <p className="font-medium text-gray-900 text-xs">{formatPrice(item.line_total, currencyObj)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal, currencyObj)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-emerald-600">Discount ({ctx?.discount_code})</span>
                    <span className="font-medium text-emerald-600">−{formatPrice(discountAmount, currencyObj)}</span>
                  </div>
                )}
                {ctx.has_shippable_items !== false && (
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Shipping ({ctx.shipping_method === "express" ? "Express" : "Standard"})
                  </span>
                  <span className="font-medium">
                    {shippingCost === 0 ? <span className="text-emerald-600">FREE</span> : formatPrice(shippingCost, currencyObj)}
                  </span>
                </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Tax{taxBreakdown.length > 0 ? ` (${taxBreakdown.map(b => b.rate).join(" + ")}%)` : ""}
                  </span>
                  <span className="font-medium">{formatPrice(tax, currencyObj)}</span>
                </div>
              </div>

              <div className="border-t pt-4 flex justify-between items-baseline">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900">{formatPrice(total, currencyObj)}</span>
              </div>

              {/* Trust badges */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Secure SSL encrypted payment
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  30-day free returns
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Test mode: test cards panel + transaction log */}
        {isTestMode && (
          <div className="mt-8 space-y-6">
            {testCardsQ.data?.cards && testCardsQ.data.cards.length > 0 && (
              <TestCardsPanel cards={testCardsQ.data.cards} onUseCard={handleUseTestCard} />
            )}

            {/* Test transaction log */}
            <div className="bg-white rounded-2xl border-2 border-amber-200 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v5.25M3.75 3h5.25M3.75 3v18M21 21v-5.25M21 21h-5.25M21 21V3M3.75 21h5.25" />
                  </svg>
                  <h3 className="font-bold text-sm">Test Transaction Log</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{testTxsQ.data?.total ?? 0} txns</span>
                  <button
                    onClick={handleClearTestTxs}
                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {testTxsQ.isLoading ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">Loading transactions...</div>
              ) : (testTxsQ.data?.transactions?.length ?? 0) === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  No test transactions yet. Process a payment to see it here.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                  {testTxsQ.data!.transactions.map((tx) => (
                    <div key={tx.id} className="px-5 py-2.5 flex items-center gap-3 text-xs hover:bg-amber-50/30">
                      {/* Status icon */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        tx.success ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                      }`}>
                        {tx.success ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <X className="w-4 h-4" strokeWidth={2.5} />}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{tx.gateway}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-600">{tx.scenario.replace(/_/g, " ")}</span>
                          {tx.card_number && (
                            <>
                              <span className="text-gray-400">·</span>
                              <span className="font-mono text-gray-500">{tx.card_number}</span>
                            </>
                          )}
                        </div>
                        <p className="text-gray-400 truncate">{tx.message}</p>
                      </div>

                      {/* Amount + time */}
                      <div className="text-right flex-shrink-0">
                        <p className="font-medium text-gray-900">{tx.currency} {tx.amount.toFixed(2)}</p>
                        <p className="text-gray-400">{tx.duration_ms}ms</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
