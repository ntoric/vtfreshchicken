"use client";

import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWishlist, addToWishlist as apiAdd, removeFromWishlist as apiRemove, removeProductFromWishlist as apiRemoveProduct } from "@/lib/api";
import { useAuth, type PendingAction } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import type { WishlistResponse } from "@/types";

interface WishlistCtx {
  wishlist: WishlistResponse | null;
  isLoading: boolean;
  productIds: Set<string>;
  toggleItem: (productId: string, variantId?: string) => void;
  removeItem: (itemId: string) => void;
  removeProduct: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  itemCount: number;
  isOpen: boolean;
  openWishlist: () => void;
  closeWishlist: () => void;
}

const Ctx = createContext<WishlistCtx>(null as any);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { isAuthenticated, setPendingAction, allowAnonymous } = useAuth();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const wlQ = useQuery<WishlistResponse>({
    queryKey: ["wishlist"],
    queryFn: () => fetchWishlist(),
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["wishlist"] });
  }, [qc]);

  const items = wlQ.data?.wishlist.items ?? [];
  const productIds = new Set(items.map((i) => i.product_id));
  const itemCount = items.length;

  const addMut = useMutation({
    mutationFn: ({ productId, variantId }: { productId: string; variantId?: string }) =>
      apiAdd(productId, variantId),
    onSuccess: () => { invalidate(); setIsOpen(true); toast.success("Added to wishlist", "Item has been saved to your wishlist."); },
    onError: (err) => { console.error("[Wishlist] addItem error:", err); toast.error("Failed to save", err.message || "Could not add item to wishlist."); },
  });

  const removeMut = useMutation({
    mutationFn: (itemId: string) => apiRemove(itemId),
    onSuccess: () => { invalidate(); toast.info("Removed", "Item removed from your wishlist."); },
    onError: (err) => { console.error("[Wishlist] removeItem error:", err); toast.error("Remove failed", err.message || "Could not remove item."); },
  });

  const removeProductMut = useMutation({
    mutationFn: (productId: string) => apiRemoveProduct(productId),
    onSuccess: () => { invalidate(); toast.info("Removed", "Item removed from your wishlist."); },
    onError: (err) => { console.error("[Wishlist] removeProduct error:", err); toast.error("Remove failed", err.message || "Could not remove item."); },
  });

  // Listen for replay events (after customer logs in)
  useEffect(() => {
    function onReplay(e: Event) {
      const detail = (e as CustomEvent<PendingAction>).detail;
      if (detail?.type === "add_to_wishlist") {
        addMut.mutate({
          productId: detail.payload.productId as string,
          variantId: detail.payload.variantId as string | undefined,
        });
      }
    }
    window.addEventListener("tc-replay-pending", onReplay);
    return () => window.removeEventListener("tc-replay-pending", onReplay);
  }, [addMut]);

  const isInWishlist = useCallback((productId: string) => productIds.has(productId), [productIds]);

  // Gate toggleItem behind auth — redirect to login if unauthenticated AND anonymous checkout is disabled
  const toggleItem = useCallback(
    (productId: string, variantId?: string) => {
      if (!isAuthenticated && !allowAnonymous) {
        const action: PendingAction = {
          type: "add_to_wishlist",
          payload: { productId, variantId },
          returnPath: window.location.pathname,
        };
        setPendingAction(action);
        router.push(`/account/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (productIds.has(productId)) {
        removeProductMut.mutate(productId);
      } else {
        addMut.mutate({ productId, variantId });
      }
    },
    [isAuthenticated, allowAnonymous, setPendingAction, router, productIds, addMut, removeProductMut],
  );

  return (
    <Ctx.Provider value={{
      wishlist: wlQ.data ?? null,
      isLoading: wlQ.isLoading,
      productIds,
      toggleItem,
      removeItem: (itemId) => removeMut.mutate(itemId),
      removeProduct: (productId) => removeProductMut.mutate(productId),
      isInWishlist,
      itemCount,
      isOpen,
      openWishlist: () => setIsOpen(true),
      closeWishlist: () => setIsOpen(false),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWishlist() {
  return useContext(Ctx);
}
