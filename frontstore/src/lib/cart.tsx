"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addToCart as apiAddToCart, fetchCart, updateCartItem, removeCartItem, clearCart } from "@/lib/api";
import { useAuth, type PendingAction } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import type { CartResponse } from "@/types";

interface CartCtx {
  cart: CartResponse | null;
  isLoading: boolean;
  addItem: (productId: string, variantId?: string, quantity?: number, unitPrice?: number, currency?: string) => void;
  updateItem: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
  itemCount: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const Ctx = createContext<CartCtx>(null as any);

export function CartProvider({ tenant, currency, children }: { tenant: string; currency: string; children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { isAuthenticated, setPendingAction, allowAnonymous } = useAuth();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const cartQ = useQuery<CartResponse>({
    queryKey: ["cart", tenant, currency],
    queryFn: () => fetchCart(tenant, currency),
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["cart", tenant, currency] });
    qc.invalidateQueries({ queryKey: ["cart-count", tenant] });
  }, [qc, tenant, currency]);

  const addMut = useMutation({
    mutationFn: (vars: { productId: string; variantId?: string; quantity: number; unitPrice?: number; currency?: string }) =>
      apiAddToCart(tenant, {
        product_id: vars.productId,
        variant_id: vars.variantId,
        quantity: vars.quantity,
        unit_price: vars.unitPrice,
        currency: vars.currency || currency,
      }),
    onSuccess: () => { invalidate(); setIsOpen(true); toast.success("Added to cart", "Item has been added to your cart."); },
    onError: (err) => { console.error("[Cart] addItem error:", err); toast.error("Failed to add", err.message || "Could not add item to cart."); },
  });

  const updateMut = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(tenant, itemId, quantity),
    onSuccess: invalidate,
    onError: (err) => { console.error("[Cart] updateItem error:", err); toast.error("Update failed", err.message || "Could not update cart item."); },
  });

  const removeMut = useMutation({
    mutationFn: (itemId: string) => removeCartItem(tenant, itemId),
    onSuccess: () => { invalidate(); toast.info("Removed", "Item removed from your cart."); },
    onError: (err) => { console.error("[Cart] removeItem error:", err); toast.error("Remove failed", err.message || "Could not remove item."); },
  });

  const clearMut = useMutation({
    mutationFn: () => clearCart(tenant),
    onSuccess: () => { invalidate(); toast.info("Cart cleared", "All items removed from your cart."); },
    onError: (err) => { console.error("[Cart] clear error:", err); toast.error("Clear failed", err.message || "Could not clear cart."); },
  });

  // Listen for replay events (after customer logs in)
  useEffect(() => {
    function onReplay(e: Event) {
      const detail = (e as CustomEvent<PendingAction>).detail;
      if (detail?.type === "add_to_cart") {
        addMut.mutate({
          productId: detail.payload.productId as string,
          variantId: detail.payload.variantId as string | undefined,
          quantity: detail.payload.quantity as number,
          unitPrice: detail.payload.unitPrice as number | undefined,
          currency: detail.payload.currency as string | undefined,
        });
      }
    }
    window.addEventListener("tc-replay-pending", onReplay);
    return () => window.removeEventListener("tc-replay-pending", onReplay);
  }, [addMut]);

  // Gate addItem behind auth — redirect to login if unauthenticated AND anonymous checkout is disabled
  const addItem = useCallback(
    (productId: string, variantId?: string, quantity = 1, unitPrice?: number, cur?: string) => {
      if (!isAuthenticated && !allowAnonymous) {
        const action: PendingAction = {
          type: "add_to_cart",
          payload: { productId, variantId, quantity, unitPrice, currency: cur },
          returnPath: window.location.pathname,
        };
        setPendingAction(action);
        router.push(`/${tenant}/account/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      addMut.mutate({ productId, variantId, quantity, unitPrice, currency: cur });
    },
    [isAuthenticated, allowAnonymous, setPendingAction, router, tenant, addMut],
  );

  const itemCount = cartQ.data?.cart.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <Ctx.Provider value={{
      cart: cartQ.data ?? null,
      isLoading: cartQ.isLoading,
      addItem,
      updateItem: (itemId, quantity) => updateMut.mutate({ itemId, quantity }),
      removeItem: (itemId) => removeMut.mutate(itemId),
      clear: () => clearMut.mutate(),
      itemCount,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  return useContext(Ctx);
}
