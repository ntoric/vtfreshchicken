"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchBootstrap, fetchOrder } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { FullPageLoader } from "@/components/Loaders";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { getCurrencySymbol } from "@/lib/format";
import type { OrderResponse } from "@/types";
import { useCurrencyLang } from "@/lib/currency-lang";

const ORDER_CTX_KEY = "tc_order_response";

// Lightweight confetti animation using canvas
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#f59e0b", "#60a5fa", "#a78bfa"];
    const particles: Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number; rot: number; vrot: number }> = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 3,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -12 - 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.3,
      });
    }

    let frame = 0;
    const maxFrames = 180;

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4; // gravity
        p.vx *= 0.99;
        p.rot += p.vrot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}

// Post-purchase registration prompt for guest customers
function GuestRegisterPrompt({ tenant, order, onRegistered }: { tenant: string; order: OrderResponse["order"]; onRegistered: () => void }) {
  const { isAuthenticated, registerFromOrder } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Don't show if already authenticated or dismissed
  if (isAuthenticated || dismissed) return null;

  const email = order.customer_email || order.shipping_address?.email;
  const fullName = order.customer_name || [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ");
  const phone = order.shipping_address?.phone || "";

  if (!email) return null;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await registerFromOrder(tenant, email!, password, fullName || "Customer", phone);
      onRegistered();
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-brand/5 to-brand/10 border border-brand/20 rounded-2xl p-6 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-lg">Save your order history</h3>
          <p className="text-sm text-gray-600 mt-1">
            Create an account to track your order, save your details for next time, and earn rewards.
            We'll link this order to your new account automatically.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleRegister} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={fullName || ""}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Create a password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:input-brand-focus"
          />
        </div>
        {error && <p className="text-sm text-rose-500 bg-rose-50 rounded-lg p-2">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account & link order"}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-sm text-gray-500 font-medium hover:text-gray-700"
          >
            No thanks
          </button>
        </div>
      </form>
    </div>
  );
}

// Success state shown after guest registers from order
function GuestRegisteredSuccess({ tenant }: { tenant: string }) {
  const { customer } = useAuth();
  if (!customer) return null;
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-emerald-900 text-lg">Account created!</h3>
          <p className="text-sm text-emerald-700 mt-1">
            Welcome, {customer.full_name}! Your order has been linked to your new account.
            You can now track orders, save addresses, and checkout faster.
          </p>
          <div className="flex gap-3 mt-3">
            <Link
              href={`/${tenant}/account/dashboard`}
              className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
            >
              Go to My Account
            </Link>
            <Link
              href={`/${tenant}/orders`}
              className="border border-emerald-300 text-emerald-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-100 transition"
            >
              View Order History
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessContent({ tenant }: { tenant: string }) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { isAuthenticated } = useAuth();
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const [cachedResponse, setCachedResponse] = useState<OrderResponse | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [guestRegistered, setGuestRegistered] = useState(false);

  // Read cached order response from sessionStorage (set by payment page)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ORDER_CTX_KEY);
      if (raw) {
        setCachedResponse(JSON.parse(raw) as OrderResponse);
      }
    } catch {
      // ignore
    }
    // Stop confetti after 4 seconds
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap", tenant],
    queryFn: () => fetchBootstrap(tenant),
  });

  const orderQ = useQuery({
    queryKey: ["order", tenant, orderId],
    queryFn: () => fetchOrder(tenant, orderId!),
    enabled: !!orderId && !!bootstrapQ.data,
  });

  const bootstrap = bootstrapQ.data;
  const order = orderQ.data?.order;

  // Determine currency from order or cached response
  useEffect(() => {
    if (order?.currency_code) setCurrency(order.currency_code);
  }, [order]);

  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);

  if (bootstrapQ.isLoading || orderQ.isLoading) {
    return <FullPageLoader label="Loading your order" />;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Order not found.</p>
          <Link href={`/${tenant}`} className="text-brand hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to store
          </Link>
        </div>
      </div>
    );
  }

  const transactionId = cachedResponse?.transaction_id;
  const paymentMethod = cachedResponse?.payment_method;

  return (
    <div className="min-h-screen">
      {showConfetti && <Confetti />}
      {bootstrap && (
        <Header
          tenant={tenant}
          bootstrap={bootstrap}
          currency={currency}
          setCurrency={setCurrency}
          lang={lang}
          setLang={setLang}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Success banner */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 mb-4 relative">
            <div className="absolute inset-0 rounded-full bg-emerald-200 animate-ping opacity-30" />
            <svg className="w-12 h-12 text-emerald-600 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-500 text-lg">Thank you for your purchase. Your order has been confirmed and payment has been received.</p>
        </div>

        {/* Status badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Paid</span>
          </div>
        </div>

        {/* Guest registration prompt — only for unauthenticated (guest) customers */}
        {!isAuthenticated && !guestRegistered && (
          <GuestRegisterPrompt tenant={tenant} order={order} onRegistered={() => setGuestRegistered(true)} />
        )}
        {!isAuthenticated && guestRegistered && (
          <GuestRegisteredSuccess tenant={tenant} />
        )}

        {/* Order summary */}
        <OrderSummary
          order={order}
          currencyObj={currencyObj}
          transactionId={transactionId}
          paymentMethod={paymentMethod}
        />

        {/* What's next */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-6 mt-5">
          <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            What happens next?
          </h3>
          <div className="space-y-3 text-sm text-emerald-800">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">1</span>
              <p>You will receive an order confirmation email shortly at {order.shipping_address?.email || "your email"}.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">2</span>
              <p>We will process your order and ship it within 1-2 business days.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">3</span>
              <p>You will get a tracking number once your order ships.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/${tenant}/orders/${order.id}`}
            className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-lg text-center hover:bg-emerald-700 transition shadow-md flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76V6.75A2.25 2.25 0 0 1 4.5 4.5h15A2.25 2.25 0 0 1 21.75 6.75v6a2.25 2.25 0 0 1-2.25 2.25H4.5A2.25 2.25 0 0 1 2.25 12.76ZM2.25 12.76V18A2.25 2.25 0 0 0 4.5 20.25h15A2.25 2.25 0 0 0 21.75 18v-5.24" />
            </svg>
            View Order Details
          </Link>
          <Link
            href={`/${tenant}`}
            className="flex-1 border font-semibold py-2.5 rounded-lg text-center hover:bg-gray-50 transition text-gray-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.484M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage({ params }: { params: { tenant: string } }) {
  return (
    <Suspense fallback={<FullPageLoader label="Loading" />}>
      <SuccessContent tenant={params.tenant} />
    </Suspense>
  );
}
