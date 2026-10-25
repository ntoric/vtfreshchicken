"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { ShoppingCart, Check, X, MapPin, Plus, ChevronDown, ChevronUp, Tag, CreditCard, Truck } from "lucide-react";
import {
  fetchBootstrap,
  fetchCart,
  calculateTax,
  calculateShipping,
  validateDiscountCode,
  fetchAddresses,
  fetchPaymentMethods,
  fetchTestCards,
  fetchTestTransactions,
  clearTestTransactions,
  placeOrder,
  generateIdempotencyKey,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadGuestAddresses, saveGuestAddress, removeGuestAddress, type GuestAddress } from "@/lib/guest-addresses";
import { getGateway } from "@/lib/paymentRegistry";
import { Header } from "@/components/Header";
import { Toggle } from "@/components/Toggle";
import { CartSkeleton } from "@/components/Loaders";
import { TestModeBanner, TestCardsPanel } from "@/components/payment/TestCardsPanel";
import { formatPrice, getCurrencySymbol } from "@/lib/format";
import type { AddressInput, CheckoutRequest, PaymentDetails, PaymentGatewayInfo, TestCard } from "@/types";
import { useCurrencyLang } from "@/lib/currency-lang";
import { useLocation } from "@/lib/location";

// Delivery address defaults — state/country are fixed by the configured
// service area and the city comes from the selected delivery area.
const DELIVERY_AREA = {
  state: "Kerala",
  postal_code: "",
  country: "India",
} as const;

// Draft persists address/payment choices so a failed payment or page reload
// doesn't force the user to re-enter everything.
const DRAFT_KEY = "tc_checkout_draft";
// Session storage key for passing the order response to the status pages
const ORDER_CTX_KEY = "tc_order_response";
// Legacy key from the old two-page flow — cleaned up on successful order
const LEGACY_CTX_KEY = "tc_checkout_ctx";

const emptyAddress: AddressInput = {
  first_name: "",
  last_name: "",
  email: "",
  line1: "",
  line2: "",
  city: "Malappuram",
  ...DELIVERY_AREA,
  phone: "",
};

export default function CheckoutPage({ params }: { params: {} }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, customer } = useAuth();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const { area: deliveryArea, serviceable: areaServiceable, openPicker, config: serviceArea, lat: deliveryLat, lng: deliveryLng } = useLocation();
  // Single address: delivery address is also used as the billing address
  const [address, setAddress] = useState<AddressInput>({ ...emptyAddress });
  const [shippingMethod, setShippingMethod] = useState("standard");
  // Per-item shipping methods (split-shipment support): map of cart item index → method code
  const [itemShippingMethods, setItemShippingMethods] = useState<Record<number, string>>({});
  // Toggle between order-level and per-item shipping selection
  const [splitShipping, setSplitShipping] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  // Local address book for anonymous checkouts (localStorage-backed)
  const [guestAddresses, setGuestAddresses] = useState<GuestAddress[]>([]);

  // The selected delivery area becomes the address city; state/country follow
  // the configured service area.
  useEffect(() => {
    if (deliveryArea) {
      setAddress((a) => ({
        ...a,
        city: deliveryArea,
        state: serviceArea.state || a.state,
        country: serviceArea.country || a.country,
      }));
    }
  }, [deliveryArea, serviceArea]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);

  // Pre-fill name/email from the logged-in customer profile
  useEffect(() => {
    if (customer) {
      setAddress((prev) => ({
        ...prev,
        first_name: prev.first_name || customer.full_name.split(" ")[0] || "",
        last_name: prev.last_name || customer.full_name.split(" ").slice(1).join(" ") || "",
        email: prev.email || customer.email || "",
        phone: prev.phone || customer.phone || "",
      }));
    }
  }, [customer]);

  // Whether a session draft already provided an address — if so the guest
  // address book must not overwrite it.
  const draftHadAddressRef = useRef(false);
  const guestPrefillDoneRef = useRef(false);

  // Restore a saved draft (address, delivery method, coupon, notes) on mount
  // and load the guest address book for anonymous shoppers.
  useEffect(() => {
    setGuestAddresses(loadGuestAddresses());
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as {
          address?: AddressInput;
          shipping_method?: string;
          discount_code?: string;
          notes?: string;
        };
        if (d.address) {
          draftHadAddressRef.current = true;
          setAddress((prev) => ({ ...prev, ...d.address, ...DELIVERY_AREA }));
        }
        if (d.shipping_method) setShippingMethod(d.shipping_method);
        if (d.discount_code) setDiscountCode(d.discount_code);
        if (d.notes) setNotes(d.notes);
      }
    } catch {
      // ignore malformed drafts
    }
  }, []);

  // Prefill the most recently used guest address for anonymous checkouts once
  // auth state is known. Runs once — later edits/delivery-area changes win.
  useEffect(() => {
    if (authLoading || guestPrefillDoneRef.current) return;
    guestPrefillDoneRef.current = true;
    if (isAuthenticated || draftHadAddressRef.current) return;
    const last = guestAddresses[0];
    if (!last) return;
    setSelectedAddressId(last.id);
    setAddress((prev) => ({
      ...prev,
      first_name: last.first_name || "",
      last_name: last.last_name || "",
      email: last.email || "",
      line1: last.line1,
      line2: last.line2 || "",
      city: deliveryArea || last.city || prev.city,
      state: serviceArea.state || prev.state,
      postal_code: "",
      country: serviceArea.country || prev.country,
      phone: last.phone || "",
    }));
  }, [authLoading, isAuthenticated, guestAddresses, deliveryArea, serviceArea]);

  // Persist the draft whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        address,
        shipping_method: shippingMethod,
        discount_code: discountCode,
        notes,
      }));
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [address, shippingMethod, discountCode, notes]);

  // Fetch saved addresses for authenticated users
  const addressesQ = useQuery({
    queryKey: ["addresses"],
    queryFn: () => fetchAddresses(),
    enabled: isAuthenticated,
    staleTime: 60000,
  });
  const savedAddresses = addressesQ.data?.items ?? [];

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  const cartQ = useQuery({
    queryKey: ["cart", currency],
    queryFn: () => fetchCart(currency),
    enabled: !!bootstrapQ.data,
  });

  const methodsQ = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => fetchPaymentMethods(),
    enabled: !!bootstrapQ.data,
  });

  const isTestMode = methodsQ.data?.test_mode ?? false;

  // Per-gateway test mode comes from the store's payment config, exposed on
  // each method via public_config.test_mode. The env-level flag above is still
  // required since the test endpoints are only available outside production.
  const paymentMethods = methodsQ.data?.methods ?? [];
  const inTestMode = (m: PaymentGatewayInfo) => m.public_config?.test_mode === true;
  // Test cards only apply to the card-group gateway, and only while that
  // method itself is enabled in test mode.
  const cardTestMethod = isTestMode
    ? paymentMethods.find((m) => m.group === "card" && inTestMode(m))
    : undefined;
  const anyTestModeMethod = isTestMode && paymentMethods.some(inTestMode);

  // Fetch test cards (only when a card gateway in test mode is available)
  const testCardsQ = useQuery({
    queryKey: ["test-cards"],
    queryFn: () => fetchTestCards(),
    enabled: !!cardTestMethod && !!bootstrapQ.data,
  });

  // Fetch the test transaction log whenever test mode is active so already
  // logged test payments stay visible even if no gateway is currently flagged.
  const testTxsQ = useQuery({
    queryKey: ["test-transactions"],
    queryFn: () => fetchTestTransactions(),
    enabled: isTestMode && !!bootstrapQ.data,
  });
  const hasTestTxns = (testTxsQ.data?.total ?? 0) > 0;
  // The log shows when any enabled method is in test mode, or when test
  // payments have already been recorded.
  const showTestTxLog = anyTestModeMethod || hasTestTxns;

  const bootstrap = bootstrapQ.data;
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const cart = cartQ.data?.cart;
  const items = cart?.items ?? [];
  const subtotal = cartQ.data?.subtotal ?? 0;

  // Determine if the cart has any shippable items (physical products)
  const hasShippableItems = items.length === 0 || items.some(i => i.requires_shipping !== false);

  // Calculate shipping options from server when the delivery country is available
  const shippingQ = useQuery({
    queryKey: ["shipping", address.country, address.state, subtotal, items.map(i => `${i.id}:${i.quantity}:${i.requires_shipping ?? true}:${i.free_shipping ?? false}`).join(",")],
    queryFn: () => calculateShipping(
      subtotal,
      { line1: address.line1, city: address.city, state: address.state, postal_code: address.postal_code, country: address.country },
      currency,
      items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        line_total: i.line_total,
        requires_shipping: i.requires_shipping ?? true,
        weight: i.weight ?? 0,
        free_shipping: i.free_shipping ?? false,
      })),
    ),
    enabled: !!cart && items.length > 0 && hasShippableItems && !!address.country,
    staleTime: 30000,
  });

  const shippingOptions = shippingQ.data?.options ?? [];
  const perItemOptions = shippingQ.data?.per_item_options ?? [];
  // Delivery is free while no paid shipping method is enabled in the backoffice.
  const freeDeliveryOnly = shippingOptions.every((o) => o.is_free || o.rate <= 0);

  // Keep the selected method pointed at a real configured option.
  useEffect(() => {
    if (shippingOptions.length > 0 && !shippingOptions.some((o) => o.code === shippingMethod)) {
      setShippingMethod(shippingOptions[0].code);
    }
  }, [shippingOptions, shippingMethod]);
  // Find the selected option's rate; fall back to legacy hardcoded rates if no options
  const selectedOption = shippingOptions.find(o => o.code === shippingMethod);
  // Per-item shipping cost (split-shipment): sum the selected method's rate for each shippable item
  const perItemShippingCost = (() => {
    if (!splitShipping || perItemOptions.length === 0) return 0;
    let total = 0;
    items.forEach((it, idx) => {
      if (it.requires_shipping === false) return;
      const opts = perItemOptions.find(p => p.product_id === it.product_id)?.options ?? shippingOptions;
      const code = itemShippingMethods[idx] ?? shippingMethod;
      const opt = opts.find(o => o.code === code);
      if (opt) total += opt.rate;
    });
    return total;
  })();
  const shippingCost = !hasShippableItems
    ? 0
    : splitShipping
      ? perItemShippingCost
      : selectedOption
        ? selectedOption.rate
        : freeDeliveryOnly
          ? 0
          : shippingMethod === "express" ? 15 : subtotal >= 50 ? 0 : 5.99;

  // Calculate tax from server when the delivery country is available
  const taxQ = useQuery({
    queryKey: ["tax", address.country, address.state, shippingMethod, splitShipping, JSON.stringify(itemShippingMethods), subtotal, items.map(i => `${i.id}:${i.quantity}:${i.line_total}`).join(",")],
    queryFn: () => calculateTax(
      items.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: i.line_total,
        tax_class_id: i.tax_class_id,
      })),
      { line1: address.line1, city: address.city, state: address.state, postal_code: address.postal_code, country: address.country },
      shippingCost,
    ),
    enabled: !!cart && items.length > 0 && !!address.country,
    staleTime: 30000,
  });

  const tax = taxQ.data?.tax_total ?? 0;
  const taxBreakdown = taxQ.data?.breakdown ?? [];

  // Discount validation
  const discountQ = useQuery({
    queryKey: ["discount-validate", discountCode, subtotal],
    queryFn: () => validateDiscountCode(discountCode, subtotal),
    enabled: !!cart && items.length > 0 && discountCode.length > 0,
    staleTime: 30000,
  });
  const discountAmount = discountQ.data?.valid ? (discountQ.data.discount || 0) : 0;
  const total = subtotal - discountAmount + shippingCost + tax;

  // Auto-select first available payment method
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
    mutationFn: (req: CheckoutRequest) => placeOrder(req, idemKeyRef.current || undefined),
    onSuccess: (res) => {
      idemKeyRef.current = "";
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(LEGACY_CTX_KEY);
      // Store the full order response for the status page to read
      sessionStorage.setItem(ORDER_CTX_KEY, JSON.stringify(res));
      // Immediately remove cart queries from cache so the UI shows an empty cart
      // without waiting for a refetch (the backend has already cleared the cart).
      qc.removeQueries({ queryKey: ["cart"] });
      qc.removeQueries({ queryKey: ["cart-count"] });
      // Redirect to the order status page based on the order status
      const status = res.order.status;
      if (status === "pending") {
        router.push(`/checkout/pending?orderId=${res.order.id}`);
      } else {
        router.push(`/checkout/success?orderId=${res.order.id}`);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
      // Redirect to the failed page with the error message
      // Store the error in sessionStorage since query params have length limits
      sessionStorage.setItem("tc_payment_error", err.message);
      router.push(`/checkout/failed?error=${encodeURIComponent(err.message.slice(0, 200))}`);
      // Refetch test transactions so the failed attempt shows up in the log
      if (isTestMode) {
        setTimeout(() => testTxsQ.refetch(), 500);
      }
    },
  });

  // Handle "use test card" from the TestCardsPanel — dispatch a custom event
  // that the CardGateway component listens for
  const handleUseTestCard = useCallback((card: TestCard) => {
    // Switch to the test-mode card gateway if not already selected
    const target = cardTestMethod?.id ?? "card";
    if (selectedMethod !== target) {
      setSelectedMethod(target);
    }
    // Dispatch event for CardGateway to pick up
    window.dispatchEvent(new CustomEvent("tc:useTestCard", {
      detail: { number: card.number, brand: card.brand },
    }));
  }, [selectedMethod, cardTestMethod]);

  const handleClearTestTxs = useCallback(async () => {
    await clearTestTransactions();
    testTxsQ.refetch();
  }, [testTxsQ]);

  function validateCheckout(): boolean {
    setError("");
    // Delivery address doubles as the billing address
    if (!address.first_name || !address.last_name) return setError("Please enter your first and last name"), false;
    if (!address.email) return setError("Email is required"), false;
    if (hasShippableItems) {
      if (!deliveryArea) {
        openPicker();
        return setError("Please select your delivery area to continue."), false;
      }
      if (!areaServiceable) {
        return setError(`We don't deliver to ${deliveryArea} yet${serviceArea.label ? ` — we currently serve ${serviceArea.label}` : ""}.`), false;
      }
      if (!address.line1) return setError("Delivery street address is required"), false;
    }
    if (!selectedMethod) return setError("Please select a payment method."), false;
    if (!paymentDetails) return setError("Please complete the payment details for the selected method."), false;
    return true;
  }

  const handlePlaceOrder = useCallback(() => {
    if (!validateCheckout()) {
      // Scroll to the top where the error banner is shown
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError("");
    // Remember the delivery address locally so returning guests can pick it
    // again instead of re-typing (authenticated users get server-side
    // saved addresses instead). Dedupe keeps the list small.
    if (!isAuthenticated) {
      setGuestAddresses(saveGuestAddress(address));
    }
    // Generate a fresh idempotency key for each new checkout attempt.
    // Reused across retries of the same attempt to prevent double orders.
    if (!idemKeyRef.current) {
      idemKeyRef.current = generateIdempotencyKey();
    }
    const itemShippingMethodsArr = splitShipping
      ? Object.entries(itemShippingMethods).map(([idx, code]) => ({ cart_item_index: parseInt(idx), method_code: code }))
      : undefined;
    const req: CheckoutRequest = {
      // Delivery address is used for both shipping and billing
      shipping_address: address,
      billing_address: address,
      payment_method: selectedMethod!,
      payment_details: paymentDetails ?? undefined,
      currency_code: currency,
      discount_code: discountCode || undefined,
      shipping_method: hasShippableItems ? shippingMethod : "",
      notes: notes || undefined,
      item_shipping_methods: itemShippingMethodsArr,
      delivery_area: deliveryArea ?? undefined,
      delivery_lat: deliveryLat ?? undefined,
      delivery_lng: deliveryLng ?? undefined,
    };
    placeOrderMut.mutate(req);
  }, [address, isAuthenticated, selectedMethod, paymentDetails, currency, discountCode, notes, shippingMethod, hasShippableItems, splitShipping, itemShippingMethods, placeOrderMut, deliveryArea, deliveryLat, deliveryLng, areaServiceable, openPicker]);

  if (bootstrapQ.isLoading) {
    return <CartSkeleton />;
  }
  if (!bootstrap) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load store.</div>;
  }

  if (cartQ.isLoading) {
    return (
      <div className="min-h-screen">
        <Header bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <CartSkeleton />
        </div>
      </div>
    );
  }

  if (items.length === 0 && !placeOrderMut.isSuccess) {
    return (
      <div className="min-h-screen">
        <Header bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="flex justify-center mb-4">
            <ShoppingCart className="w-16 h-16 text-gray-300" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-500 mb-6">Add items to your cart before checking out.</p>
          <Link href={``} className="inline-block bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition">
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
  const selectedMethodInfo = availableMethods.find((m) => m.id === selectedMethod);
  const isOfflinePayment = selectedMethodInfo?.group === "cash";

  return (
    <div className="min-h-screen">
      <Header bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
          <Link href={``} className="hover:text-brand whitespace-nowrap">Home</Link>
          <span>/</span>
          <Link href={`/cart`} className="hover:text-brand whitespace-nowrap">Cart</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium whitespace-nowrap">Checkout</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 sm:mb-6">Checkout</h1>

        {anyTestModeMethod && <TestModeBanner />}

        {error && (
          <div className="bg-rose-50 text-rose-600 rounded-xl px-4 py-3 mb-6 text-sm font-medium flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8">
          {/* Main content — delivery address, delivery method, payment */}
          <div className="space-y-6">
            {/* Delivery Address (also used as billing address) */}
            <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  Delivery Address
                </h2>
                <p className="text-xs text-gray-500 mt-1">This address will also be used as your billing address.</p>
              </div>

              {/* Selected delivery area — drives the address city */}
              <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                deliveryArea && !areaServiceable
                  ? "border-rose-200 bg-rose-50"
                  : "border-stone-200 bg-[#faf7f1]"
              }`}>
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <MapPin className={`w-4 h-4 shrink-0 ${deliveryArea && !areaServiceable ? "text-rose-500" : "text-brand"}`} />
                  {deliveryArea ? (
                    <span className="text-gray-800 truncate">
                      Delivering to <strong>{deliveryArea}</strong>
                      {serviceArea.label ? `, ${serviceArea.label}` : ""}
                    </span>
                  ) : (
                    <span className="text-gray-500">Select your delivery area</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openPicker}
                  className="text-sm font-semibold text-brand hover:underline shrink-0"
                >
                  {deliveryArea ? "Change" : "Select"}
                </button>
              </div>
              {deliveryArea && !areaServiceable && (
                <p className="text-xs text-rose-600 -mt-2">
                  We don&apos;t deliver to {deliveryArea} yet — pick a listed area to place your order.
                </p>
              )}

              {/* Saved address selector — server-side addresses for logged-in
                  users, localStorage guest addresses for anonymous shoppers */}
              {((isAuthenticated && savedAddresses.length > 0) ||
                (!authLoading && !isAuthenticated && guestAddresses.length > 0)) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 text-brand" />
                    Saved Addresses
                    {!isAuthenticated && (
                      <span className="text-[11px] font-normal text-gray-400">(on this device)</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {!isAuthenticated && guestAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setSelectedAddressId(addr.id);
                          setAddress({
                            first_name: addr.first_name || "",
                            last_name: addr.last_name || "",
                            email: addr.email || "",
                            line1: addr.line1,
                            line2: addr.line2 || "",
                            city: deliveryArea || addr.city || serviceArea.areas[0] || "",
                            state: serviceArea.state || DELIVERY_AREA.state,
                            postal_code: "",
                            country: serviceArea.country || DELIVERY_AREA.country,
                            phone: addr.phone || "",
                          });
                        }}
                        className={`text-left p-4 rounded-xl border-2 transition relative ${
                          selectedAddressId === addr.id
                            ? "border-brand bg-brand-light ring-1 ring-brand"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span
                          role="button"
                          tabIndex={-1}
                          aria-label="Remove saved address"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGuestAddresses(removeGuestAddress(addr.id));
                            if (selectedAddressId === addr.id) setSelectedAddressId("");
                          }}
                          className="absolute top-2 right-2 p-1 rounded-full text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </span>
                        <p className="font-medium text-gray-900 text-sm mb-1">
                          {addr.first_name} {addr.last_name}
                        </p>
                        <p className="text-xs text-gray-500 break-words">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                        <p className="text-xs text-gray-500">{addr.city}, {addr.state} {addr.postal_code}</p>
                        <p className="text-xs text-gray-500">{addr.country}</p>
                        {addr.phone && <p className="text-xs text-gray-400 mt-1">{addr.phone}</p>}
                      </button>
                    ))}
                    {isAuthenticated && savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setSelectedAddressId(addr.id);
                          setAddress({
                            first_name: addr.first_name || "",
                            last_name: addr.last_name || "",
                            email: addr.email || "",
                            line1: addr.line1,
                            line2: addr.line2 || "",
                            city: deliveryArea || serviceArea.areas[0] || "",
                            state: serviceArea.state || DELIVERY_AREA.state,
                            postal_code: "",
                            country: serviceArea.country || DELIVERY_AREA.country,
                            phone: addr.phone || "",
                          });
                        }}
                        className={`text-left p-4 rounded-xl border-2 transition relative ${
                          selectedAddressId === addr.id
                            ? "border-brand bg-brand-light ring-1 ring-brand"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {addr.is_default && (
                          <span className="absolute top-2 right-2 text-[10px] font-bold text-brand bg-brand-light px-2 py-0.5 rounded-full">
                            DEFAULT
                          </span>
                        )}
                        <p className="font-medium text-gray-900 text-sm mb-1">
                          {addr.first_name} {addr.last_name}
                        </p>
                        <p className="text-xs text-gray-500 break-words">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                        <p className="text-xs text-gray-500">{addr.city}, {addr.state} {addr.postal_code}</p>
                        <p className="text-xs text-gray-500">{addr.country}</p>
                        {addr.phone && <p className="text-xs text-gray-400 mt-1">{addr.phone}</p>}
                      </button>
                    ))}
                    {/* "Enter new address" button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressId("");
                        setAddress({ ...emptyAddress });
                      }}
                      className={`p-4 rounded-xl border-2 border-dashed transition flex items-center justify-center gap-2 text-sm font-medium ${
                        selectedAddressId === ""
                          ? "border-brand text-brand bg-brand-light"
                          : "border-gray-300 text-gray-500 hover:border-gray-400"
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      Enter new address
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="First Name *">
                  <input value={address.first_name} onChange={(e) => setAddress({ ...address, first_name: e.target.value })} className={inputCls} placeholder="John" />
                </FormField>
                <FormField label="Last Name *">
                  <input value={address.last_name} onChange={(e) => setAddress({ ...address, last_name: e.target.value })} className={inputCls} placeholder="Doe" />
                </FormField>
              </div>
              <FormField label="Email *">
                <input type="email" value={address.email} onChange={(e) => setAddress({ ...address, email: e.target.value })} className={inputCls} placeholder="john@example.com" />
              </FormField>
              <FormField label="Street Address *">
                <input value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} className={inputCls} placeholder="House name / no., street, landmark" />
              </FormField>
              <FormField label="Phone">
                <input value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} className={inputCls} placeholder="+91 98XXXXXX00" />
              </FormField>
            </div>

            {/* Delivery Method (only when items need shipping) */}
            {hasShippableItems ? (
              <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </svg>
                    Delivery Method
                  </h2>
                  {!freeDeliveryOnly && perItemOptions.length > 0 && items.filter(i => i.requires_shipping !== false).length > 1 && (
                    <span className="flex items-center gap-2 text-xs text-gray-600">
                      <Toggle
                        size="sm"
                        checked={splitShipping}
                        onChange={setSplitShipping}
                      />
                      Ship items separately
                    </span>
                  )}
                </div>
                {freeDeliveryOnly ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 shrink-0">
                      <Truck className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-emerald-800 text-sm">Free delivery</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {shippingOptions[0]?.estimated_delivery || shippingOptions[0]?.description || "No delivery charge on any order."}
                      </p>
                    </div>
                    <span className="text-xs font-bold tracking-wide text-emerald-600">FREE</span>
                  </div>
                ) : splitShipping && perItemOptions.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500">Choose a shipping method for each item. Items ship in separate packages.</p>
                    {items.map((it, idx) => {
                      if (it.requires_shipping === false) return null;
                      const opts = perItemOptions.find(p => p.product_id === it.product_id)?.options ?? shippingOptions;
                      const sel = itemShippingMethods[idx] ?? shippingMethod;
                      return (
                        <div key={it.id} className="border rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{it.product_name}</p>
                              <p className="text-xs text-gray-400">Qty {it.quantity}</p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {opts.length > 0 ? opts.map((opt) => (
                              <label key={opt.code} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                                sel === opt.code ? "border-brand bg-brand-light" : "border-gray-200 hover:border-gray-300"
                              }`}>
                                <div className="flex items-center gap-2">
                                  <input type="radio" checked={sel === opt.code} onChange={() => setItemShippingMethods(prev => ({ ...prev, [idx]: opt.code }))} className="text-brand" />
                                  <div>
                                    <p className="font-medium text-gray-900 text-xs">{opt.name}</p>
                                    <p className="text-xs text-gray-500">{opt.estimated_delivery || opt.description}</p>
                                  </div>
                                </div>
                                <span className="font-bold text-gray-900 text-xs">
                                  {opt.is_free ? <span className="text-emerald-600">FREE</span> : formatPrice(opt.rate, currencyObj)}
                                </span>
                              </label>
                            )) : (
                              <p className="text-xs text-gray-400">No shipping options available.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div className="space-y-2">
                  {shippingOptions.length > 0 ? (
                    shippingOptions.map((opt) => (
                      <label key={opt.code} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition ${
                        shippingMethod === opt.code ? "border-brand bg-brand-light" : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <div className="flex items-center gap-3">
                          <input type="radio" checked={shippingMethod === opt.code} onChange={() => setShippingMethod(opt.code)} className="text-brand" />
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{opt.name}</p>
                            <p className="text-xs text-gray-500">
                              {opt.estimated_delivery || (opt.description || "")}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-gray-900 text-sm">
                          {opt.is_free ? <span className="text-emerald-600">FREE</span> : formatPrice(opt.rate, currencyObj)}
                        </span>
                      </label>
                    ))
                  ) : (
                    <>
                      <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition ${
                        shippingMethod === "standard" ? "border-brand bg-brand-light" : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <div className="flex items-center gap-3">
                          <input type="radio" checked={shippingMethod === "standard"} onChange={() => setShippingMethod("standard")} className="text-brand" />
                          <div>
                            <p className="font-medium text-gray-900 text-sm">Standard Shipping</p>
                            <p className="text-xs text-gray-500">3-5 business days</p>
                          </div>
                        </div>
                        <span className="font-bold text-gray-900 text-sm">
                          {subtotal >= 50 ? <span className="text-emerald-600">FREE</span> : formatPrice(5.99, currencyObj)}
                        </span>
                      </label>
                      <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition ${
                        shippingMethod === "express" ? "border-brand bg-brand-light" : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <div className="flex items-center gap-3">
                          <input type="radio" checked={shippingMethod === "express"} onChange={() => setShippingMethod("express")} className="text-brand" />
                          <div>
                            <p className="font-medium text-gray-900 text-sm">Express Shipping</p>
                            <p className="text-xs text-gray-500">1-2 business days</p>
                          </div>
                        </div>
                        <span className="font-bold text-gray-900 text-sm">{formatPrice(15, currencyObj)}</span>
                      </label>
                    </>
                  )}
                </div>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 sm:p-6">
                <p className="font-medium text-emerald-700 text-sm">No shipping required</p>
                <p className="text-xs text-emerald-600 mt-0.5">Your cart contains only digital/no-shipping items.</p>
              </div>
            )}

            {/* Coupon + notes */}
            <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-4">
              {/* Coupon collapsible — only when the store has an active discount code */}
              {bootstrap.discounts_enabled && (
              <div>
                <button
                  type="button"
                  onClick={() => setCouponOpen((v) => !v)}
                  className="w-full flex items-center justify-between text-left group"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    <Tag className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
                    {discountCode && discountQ.data?.valid ? (
                      <span className="text-emerald-600">Coupon applied: {discountCode}</span>
                    ) : (
                      "I Have a Coupon"
                    )}
                  </span>
                  {couponOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" strokeWidth={2} />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" strokeWidth={2} />
                  )}
                </button>
                {couponOpen && (
                  <div className="mt-3 space-y-2">
                    <FormField label="Discount Code">
                      <input value={discountCode} onChange={(e) => setDiscountCode(e.target.value.toUpperCase())} className={inputCls} placeholder="WELCOME10" />
                    </FormField>
                    {discountCode && discountQ.isLoading && (
                      <p className="text-xs text-gray-400">Checking code…</p>
                    )}
                    {discountCode && discountQ.data?.valid && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Valid! You save {formatPrice(discountAmount, currencyObj)}
                      </p>
                    )}
                    {discountCode && discountQ.data && !discountQ.data.valid && (
                      <p className="text-xs text-rose-500 flex items-center gap-1">
                        <X className="w-3.5 h-3.5" strokeWidth={2.5} /> {discountQ.data.error || "Invalid discount code"}
                      </p>
                    )}
                  </div>
                )}
              </div>
              )}
              <FormField label="Order Notes (optional)">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={2} placeholder="Special delivery instructions..." />
              </FormField>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl border p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                </svg>
                Payment Method
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

            {/* Selected gateway form — third-party providers (Razorpay, PayPal)
                surface their hosted flow here before the order is placed. */}
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

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 gap-3">
              <Link href={`/cart`} className="flex items-center gap-1.5 text-gray-600 font-medium hover:text-gray-900 whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                <span className="hidden sm:inline">Back to Cart</span>
                <span className="sm:hidden">Cart</span>
              </Link>

              <button
                onClick={handlePlaceOrder}
                disabled={placeOrderMut.isPending}
                className="bg-emerald-600 text-white font-semibold px-4 sm:px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {placeOrderMut.isPending ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M16.023 9.348h4.992M2.985 19.644v-4.992M19.644 2.985l-3.232 3.232M5.376 18.624l3.232-3.232M9.348 16.023v4.992M19.644 2.985H14.652M2.985 14.652V9.348" />
                    </svg>
                    Placing Order...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    {isOfflinePayment
                      ? `Place Order · ${formatPrice(total, currencyObj)}`
                      : `Pay ${formatPrice(total, currencyObj)} & Place Order`}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Order summary sidebar */}
          <div className="lg:sticky lg:top-28 h-fit">
            <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-lg">Order Summary</h2>

              {/* Items mini list */}
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
                    <span className="text-emerald-600">Discount</span>
                    <span className="font-medium text-emerald-600">−{formatPrice(discountAmount, currencyObj)}</span>
                  </div>
                )}
                {hasShippableItems && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
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
                  Secure SSL encrypted checkout
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
        {(cardTestMethod || showTestTxLog) && (
          <div className="mt-8 space-y-6">
            {cardTestMethod && testCardsQ.data?.cards && testCardsQ.data.cards.length > 0 && (
              <TestCardsPanel cards={testCardsQ.data.cards} onUseCard={handleUseTestCard} />
            )}

            {/* Test transaction log */}
            {showTestTxLog && (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Helper components ============
const inputCls = "w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand transition";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
