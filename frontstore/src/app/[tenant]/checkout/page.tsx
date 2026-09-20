"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ShoppingCart, Check, X, MapPin, Plus, ChevronDown, ChevronUp, Tag } from "lucide-react";
import { fetchBootstrap, fetchCart, calculateTax, calculateShipping, validateDiscountCode, fetchAddresses } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { CartSkeleton } from "@/components/Loaders";
import { Toggle } from "@/components/Toggle";
import { formatPrice, getCurrencySymbol } from "@/lib/format";
import type { AddressInput, Address } from "@/types";
import { useCurrencyLang } from "@/lib/currency-lang";

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "Spain", "Italy", "Netherlands", "Japan", "India", "Brazil", "Mexico", "Other",
];

type Step = 1 | 2 | 3;

const CHECKOUT_CTX_KEY = "tc_checkout_ctx";

const emptyAddress: AddressInput = {
  first_name: "",
  last_name: "",
  email: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "United States",
  phone: "",
};

export default function CheckoutPage({ params }: { params: { tenant: string } }) {
  const router = useRouter();
  const { isAuthenticated, customer } = useAuth();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const [step, setStep] = useState<Step>(1);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shippingAddr, setShippingAddr] = useState<AddressInput>({ ...emptyAddress });
  const [billingAddr, setBillingAddr] = useState<AddressInput>({ ...emptyAddress });
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

  // Pre-fill name/email from the logged-in customer profile (billing address first)
  useEffect(() => {
    if (customer) {
      setBillingAddr((prev) => ({
        ...prev,
        first_name: prev.first_name || customer.full_name.split(" ")[0] || "",
        last_name: prev.last_name || customer.full_name.split(" ").slice(1).join(" ") || "",
        email: prev.email || customer.email || "",
        phone: prev.phone || customer.phone || "",
      }));
    }
  }, [customer]);

  // Fetch saved addresses for authenticated users
  const addressesQ = useQuery({
    queryKey: ["addresses", params.tenant],
    queryFn: () => fetchAddresses(params.tenant),
    enabled: isAuthenticated,
    staleTime: 60000,
  });
  const savedAddresses = addressesQ.data?.items ?? [];

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap", params.tenant],
    queryFn: () => fetchBootstrap(params.tenant),
  });

  const cartQ = useQuery({
    queryKey: ["cart", params.tenant, currency],
    queryFn: () => fetchCart(params.tenant, currency),
    enabled: !!bootstrapQ.data,
  });

  const bootstrap = bootstrapQ.data;
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const cart = cartQ.data?.cart;
  const items = cart?.items ?? [];
  const subtotal = cartQ.data?.subtotal ?? 0;

  // Determine if the cart has any shippable items (physical products)
  const hasShippableItems = items.length === 0 || items.some(i => i.requires_shipping !== false);

  // The effective shipping address: billing address when "same as billing" or no shipping needed
  const effectiveShippingAddr = (!hasShippableItems || sameAsBilling) ? billingAddr : shippingAddr;

  // Calculate shipping options from server when shipping address country is available
  const shippingQ = useQuery({
    queryKey: ["shipping", params.tenant, effectiveShippingAddr.country, effectiveShippingAddr.state, subtotal, items.map(i => `${i.id}:${i.quantity}:${i.requires_shipping ?? true}:${i.free_shipping ?? false}`).join(",")],
    queryFn: () => calculateShipping(
      params.tenant,
      subtotal,
      { line1: effectiveShippingAddr.line1, city: effectiveShippingAddr.city, state: effectiveShippingAddr.state, postal_code: effectiveShippingAddr.postal_code, country: effectiveShippingAddr.country },
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
    enabled: !!cart && items.length > 0 && hasShippableItems && !!effectiveShippingAddr.country,
    staleTime: 30000,
  });

  const shippingOptions = shippingQ.data?.options ?? [];
  const perItemOptions = shippingQ.data?.per_item_options ?? [];
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
        : shippingMethod === "express" ? 15 : subtotal >= 50 ? 0 : 5.99;

  // Calculate tax from server when address country is available
  const taxQ = useQuery({
    queryKey: ["tax", params.tenant, effectiveShippingAddr.country, effectiveShippingAddr.state, shippingMethod, splitShipping, JSON.stringify(itemShippingMethods), subtotal, items.map(i => `${i.id}:${i.quantity}:${i.line_total}`).join(",")],
    queryFn: () => calculateTax(
      params.tenant,
      items.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: i.line_total,
        tax_class_id: i.tax_class_id,
      })),
      { line1: effectiveShippingAddr.line1, city: effectiveShippingAddr.city, state: effectiveShippingAddr.state, postal_code: effectiveShippingAddr.postal_code, country: effectiveShippingAddr.country },
      shippingCost,
    ),
    enabled: !!cart && items.length > 0 && !!effectiveShippingAddr.country,
    staleTime: 30000,
  });

  const tax = taxQ.data?.tax_total ?? 0;
  const taxBreakdown = taxQ.data?.breakdown ?? [];

  // Discount validation
  const discountQ = useQuery({
    queryKey: ["discount-validate", params.tenant, discountCode, subtotal],
    queryFn: () => validateDiscountCode(params.tenant, discountCode, subtotal),
    enabled: !!cart && items.length > 0 && discountCode.length > 0,
    staleTime: 30000,
  });
  const discountAmount = discountQ.data?.valid ? (discountQ.data.discount || 0) : 0;
  const total = subtotal - discountAmount + shippingCost + tax;

  if (bootstrapQ.isLoading) {
    return <CartSkeleton />;
  }
  if (!bootstrap) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load store.</div>;
  }

  if (cartQ.isLoading) {
    return (
      <div className="min-h-screen">
        <Header tenant={params.tenant} bootstrap={bootstrap} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <CartSkeleton />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
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

  function validateStep(s: Step): boolean {
    setError("");
    if (s === 1) {
      // Billing address is always required
      if (!billingAddr.first_name || !billingAddr.last_name) return setError("Please enter your first and last name"), false;
      if (!billingAddr.line1) return setError("Billing street address is required"), false;
      if (!billingAddr.city) return setError("Billing city is required"), false;
      if (!billingAddr.country) return setError("Billing country is required"), false;
      if (!billingAddr.postal_code) return setError("Billing postal code is required"), false;
      if (!billingAddr.email) return setError("Email is required"), false;
    }
    if (s === 2 && hasShippableItems && !sameAsBilling) {
      // Shipping address only required when items need shipping and different from billing
      if (!shippingAddr.first_name || !shippingAddr.last_name) return setError("Please enter shipping name"), false;
      if (!shippingAddr.line1) return setError("Shipping street address is required"), false;
      if (!shippingAddr.city) return setError("Shipping city is required"), false;
      if (!shippingAddr.country) return setError("Shipping country is required"), false;
    }
    return true;
  }

  function nextStep() {
    if (validateStep(step)) {
      // Skip shipping step (2) when no shippable items — go directly to review (3)
      if (step === 1 && !hasShippableItems) {
        setStep(3);
      } else if (step < 3) {
        setStep((step + 1) as Step);
      }
    }
  }
  function prevStep() {
    setError("");
    // Skip shipping step (2) when going back from review and no shippable items
    if (step === 3 && !hasShippableItems) {
      setStep(1);
    } else if (step > 1) {
      setStep((step - 1) as Step);
    }
  }

  function proceedToPayment() {
    if (!validateStep(1) || (hasShippableItems && !validateStep(2))) return;
    setError("");

    const itemShippingMethodsArr = splitShipping
      ? Object.entries(itemShippingMethods).map(([idx, code]) => ({ cart_item_index: parseInt(idx), method_code: code }))
      : undefined;

    // Billing is always collected. Shipping equals billing when sameAsBilling or no shipping needed.
    const finalShippingAddr = (!hasShippableItems || sameAsBilling) ? billingAddr : shippingAddr;

    const ctx = {
      shipping_address: finalShippingAddr,
      billing_address: billingAddr,
      same_as_billing: sameAsBilling,
      shipping_method: hasShippableItems ? shippingMethod : "",
      discount_code: discountCode || undefined,
      notes: notes || undefined,
      currency,
      item_shipping_methods: itemShippingMethodsArr,
      has_shippable_items: hasShippableItems,
    };
    sessionStorage.setItem(CHECKOUT_CTX_KEY, JSON.stringify(ctx));
    router.push(`/${params.tenant}/checkout/payment`);
  }

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
          <span className="text-gray-900 font-medium whitespace-nowrap">Checkout</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 sm:mb-6">Checkout</h1>

        {/* Stepper */}
        <div className="flex items-center mb-6 sm:mb-8 overflow-x-auto no-scrollbar">
          {[
            { n: 1, label: "Billing" },
            ...(hasShippableItems ? [{ n: 2 as Step, label: "Shipping" }] : []),
            { n: hasShippableItems ? 3 : 2, label: "Review" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                  step >= s.n ? "bg-brand text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {step > s.n ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : s.n}
                </div>
                <span className={`text-sm font-medium ${step >= s.n ? "text-gray-900" : "text-gray-400"}`}>{s.label}</span>
              </div>
              {i < (hasShippableItems ? 2 : 1) && <div className={`w-8 sm:w-12 h-0.5 mx-2 ${step > s.n ? "bg-brand" : "bg-gray-200"}`} />}
            </div>
          ))}
          {/* Payment step indicator (not clickable, shows what's next) */}
          <div className="w-8 sm:w-12 h-0.5 mx-2 bg-gray-200" />
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-400">{hasShippableItems ? 4 : 3}</div>
            <span className="text-sm font-medium text-gray-400">Payment</span>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 rounded-xl px-4 py-3 mb-6 text-sm font-medium flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8">
          {/* Main content */}
          <div className="space-y-6">
            {/* Step 1: Billing Address */}
            {step === 1 && (
              <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-5 animate-fade-in-up">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                  </svg>
                  Billing Address
                </h2>

                {/* Saved address selector (authenticated users only) */}
                {isAuthenticated && savedAddresses.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <MapPin className="w-4 h-4 text-brand" />
                      Saved Addresses
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedAddresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => {
                            setSelectedAddressId(addr.id);
                            setBillingAddr({
                              first_name: addr.first_name || "",
                              last_name: addr.last_name || "",
                              email: addr.email || "",
                              line1: addr.line1,
                              line2: addr.line2 || "",
                              city: addr.city,
                              state: addr.state || "",
                              postal_code: addr.postal_code || "",
                              country: addr.country,
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
                          setBillingAddr({ ...emptyAddress });
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
                    <input value={billingAddr.first_name} onChange={(e) => setBillingAddr({ ...billingAddr, first_name: e.target.value })} className={inputCls} placeholder="John" />
                  </FormField>
                  <FormField label="Last Name *">
                    <input value={billingAddr.last_name} onChange={(e) => setBillingAddr({ ...billingAddr, last_name: e.target.value })} className={inputCls} placeholder="Doe" />
                  </FormField>
                </div>
                <FormField label="Email *">
                  <input type="email" value={billingAddr.email} onChange={(e) => setBillingAddr({ ...billingAddr, email: e.target.value })} className={inputCls} placeholder="john@example.com" />
                </FormField>
                <FormField label="Street Address *">
                  <input value={billingAddr.line1} onChange={(e) => setBillingAddr({ ...billingAddr, line1: e.target.value })} className={inputCls} placeholder="123 Main St" />
                </FormField>
                <FormField label="Apartment, suite, etc. (optional)">
                  <input value={billingAddr.line2} onChange={(e) => setBillingAddr({ ...billingAddr, line2: e.target.value })} className={inputCls} placeholder="Apt 4B" />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="City *">
                    <input value={billingAddr.city} onChange={(e) => setBillingAddr({ ...billingAddr, city: e.target.value })} className={inputCls} placeholder="New York" />
                  </FormField>
                  <FormField label="State / Province">
                    <input value={billingAddr.state} onChange={(e) => setBillingAddr({ ...billingAddr, state: e.target.value })} className={inputCls} placeholder="NY" />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Postal Code *">
                    <input value={billingAddr.postal_code} onChange={(e) => setBillingAddr({ ...billingAddr, postal_code: e.target.value })} className={inputCls} placeholder="10001" />
                  </FormField>
                  <FormField label="Country *">
                    <select value={billingAddr.country} onChange={(e) => setBillingAddr({ ...billingAddr, country: e.target.value })} className={inputCls}>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FormField>
                </div>
                <FormField label="Phone">
                  <input value={billingAddr.phone} onChange={(e) => setBillingAddr({ ...billingAddr, phone: e.target.value })} className={inputCls} placeholder="+1 (555) 000-0000" />
                </FormField>
              </div>
            )}

            {/* Step 2: Shipping Address (only when items need shipping) */}
            {step === 2 && hasShippableItems && (
              <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-5 animate-fade-in-up">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  Shipping Address
                </h2>

                <div className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${
                  sameAsBilling ? "border-brand bg-brand-light" : "border-gray-200"
                }`}>
                  <Toggle
                    checked={sameAsBilling}
                    onChange={setSameAsBilling}
                  />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Same as billing address</p>
                    <p className="text-xs text-gray-500">Ship to your billing address</p>
                  </div>
                </div>

                {sameAsBilling && (
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                    <p className="font-medium text-gray-900 mb-1">Shipping matches billing:</p>
                    <p>{billingAddr.first_name} {billingAddr.last_name}</p>
                    <p>{billingAddr.line1}{billingAddr.line2 ? `, ${billingAddr.line2}` : ""}</p>
                    <p>{billingAddr.city}, {billingAddr.state} {billingAddr.postal_code}</p>
                    <p>{billingAddr.country}</p>
                  </div>
                )}

                {!sameAsBilling && (
                  <div className="space-y-5 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="First Name *">
                        <input value={shippingAddr.first_name} onChange={(e) => setShippingAddr({ ...shippingAddr, first_name: e.target.value })} className={inputCls} placeholder="John" />
                      </FormField>
                      <FormField label="Last Name *">
                        <input value={shippingAddr.last_name} onChange={(e) => setShippingAddr({ ...shippingAddr, last_name: e.target.value })} className={inputCls} placeholder="Doe" />
                      </FormField>
                    </div>
                    <FormField label="Street Address *">
                      <input value={shippingAddr.line1} onChange={(e) => setShippingAddr({ ...shippingAddr, line1: e.target.value })} className={inputCls} placeholder="123 Main St" />
                    </FormField>
                    <FormField label="Apartment, suite, etc. (optional)">
                      <input value={shippingAddr.line2} onChange={(e) => setShippingAddr({ ...shippingAddr, line2: e.target.value })} className={inputCls} placeholder="Apt 4B" />
                    </FormField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="City *">
                        <input value={shippingAddr.city} onChange={(e) => setShippingAddr({ ...shippingAddr, city: e.target.value })} className={inputCls} placeholder="New York" />
                      </FormField>
                      <FormField label="State / Province">
                        <input value={shippingAddr.state} onChange={(e) => setShippingAddr({ ...shippingAddr, state: e.target.value })} className={inputCls} placeholder="NY" />
                      </FormField>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Postal Code *">
                        <input value={shippingAddr.postal_code} onChange={(e) => setShippingAddr({ ...shippingAddr, postal_code: e.target.value })} className={inputCls} placeholder="10001" />
                      </FormField>
                      <FormField label="Country *">
                        <select value={shippingAddr.country} onChange={(e) => setShippingAddr({ ...shippingAddr, country: e.target.value })} className={inputCls}>
                          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </FormField>
                    </div>
                    <FormField label="Phone">
                      <input value={shippingAddr.phone} onChange={(e) => setShippingAddr({ ...shippingAddr, phone: e.target.value })} className={inputCls} placeholder="+1 (555) 000-0000" />
                    </FormField>
                  </div>
                )}

                {/* Shipping method */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Shipping Method</h3>
                    {perItemOptions.length > 0 && items.filter(i => i.requires_shipping !== false).length > 1 && (
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={splitShipping}
                          onChange={(e) => setSplitShipping(e.target.checked)}
                          className="text-brand rounded"
                        />
                        Ship items separately
                      </label>
                    )}
                  </div>
                  {splitShipping && perItemOptions.length > 0 ? (
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
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-5 animate-fade-in-up">
                {/* Billing review */}
                <div className="bg-white rounded-2xl border p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="font-bold text-gray-900">Billing Address</h3>
                    <button onClick={() => setStep(1)} className="text-brand text-sm hover:underline whitespace-nowrap">Edit</button>
                  </div>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p className="font-medium text-gray-900">{billingAddr.first_name} {billingAddr.last_name}</p>
                    <p className="break-words">{billingAddr.email}</p>
                    <p>{billingAddr.line1}{billingAddr.line2 ? `, ${billingAddr.line2}` : ""}</p>
                    <p>{billingAddr.city}, {billingAddr.state} {billingAddr.postal_code}</p>
                    <p>{billingAddr.country}</p>
                    {billingAddr.phone && <p>{billingAddr.phone}</p>}
                  </div>
                </div>

                {/* Shipping review (only when items need shipping) */}
                {hasShippableItems && (
                <div className="bg-white rounded-2xl border p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="font-bold text-gray-900">Shipping Address</h3>
                    <button onClick={() => setStep(2)} className="text-brand text-sm hover:underline whitespace-nowrap">Edit</button>
                  </div>
                  {sameAsBilling ? (
                    <p className="text-sm text-gray-500">Same as billing address</p>
                  ) : (
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p className="font-medium text-gray-900">{shippingAddr.first_name} {shippingAddr.last_name}</p>
                    <p>{shippingAddr.line1}{shippingAddr.line2 ? `, ${shippingAddr.line2}` : ""}</p>
                    <p>{shippingAddr.city}, {shippingAddr.state} {shippingAddr.postal_code}</p>
                    <p>{shippingAddr.country}</p>
                  </div>
                  )}
                  <div className="mt-3 pt-3 border-t text-sm">
                    <span className="text-gray-500">Method: </span>
                    <span className="font-medium text-gray-900">
                      {shippingMethod === "express" ? "Express (1-2 days)" : "Standard (3-5 days)"}
                    </span>
                  </div>
                </div>
                )}

                {!hasShippableItems && (
                  <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 sm:p-6">
                    <p className="font-medium text-emerald-700 text-sm">No shipping required</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Your cart contains only digital/no-shipping items.</p>
                  </div>
                )}

                {/* Items review */}
                <div className="bg-white rounded-2xl border p-4 sm:p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Order Items ({items.length})</h3>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 text-sm">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                          {item.image_url && <img src={item.image_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.product_name}</p>
                          {item.variant_name && <p className="text-xs text-gray-500">{item.variant_name}</p>}
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-medium text-gray-900 flex-shrink-0">{formatPrice(item.line_total, currencyObj)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discount + notes */}
                <div className="bg-white rounded-2xl border p-4 sm:p-6 space-y-4">
                  {/* Coupon collapsible */}
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
                  <FormField label="Order Notes (optional)">
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={2} placeholder="Special delivery instructions..." />
                  </FormField>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-2 gap-3">
              {step > 1 ? (
                <button onClick={prevStep} className="flex items-center gap-1.5 text-gray-600 font-medium hover:text-gray-900 whitespace-nowrap">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                  Back
                </button>
              ) : (
                <Link href={`/${params.tenant}/cart`} className="flex items-center gap-1.5 text-gray-600 font-medium hover:text-gray-900 whitespace-nowrap">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                  <span className="hidden sm:inline">Back to Cart</span>
                  <span className="sm:hidden">Cart</span>
                </Link>
              )}

              {step < 3 ? (
                <button
                  onClick={nextStep}
                  className="bg-brand text-white font-semibold px-4 sm:px-6 py-2.5 rounded-lg hover:bg-brand-dark transition shadow-md flex items-center gap-2"
                >
                  Continue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={proceedToPayment}
                  className="bg-brand text-white font-semibold px-4 sm:px-6 py-2.5 rounded-lg hover:bg-brand-dark transition shadow-md flex items-center gap-2"
                >
                  Proceed to Payment
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
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
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {shippingCost === 0 ? <span className="text-emerald-600">FREE</span> : formatPrice(shippingCost, currencyObj)}
                  </span>
                </div>
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
