"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  customerLogin as apiLogin,
  customerRegister as apiRegister,
  customerRegisterFromOrder as apiRegisterFromOrder,
  getAuthToken,
  getStoredCustomer,
  clearAuthToken,
  generateIdempotencyKey,
} from "@/lib/api";
import type { CustomerUser } from "@/types";

// A pending action that should be replayed after the customer authenticates.
// e.g. add-to-cart, add-to-wishlist.
export interface PendingAction {
  type: "add_to_cart" | "add_to_wishlist";
  // Serialized arguments needed to replay the action.
  payload: Record<string, unknown>;
  // Where to navigate back after replaying.
  returnPath: string;
}

interface AuthCtx {
  customer: CustomerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingAction: PendingAction | null;
  allowAnonymous: boolean;
  login: (email: string, password: string) => Promise<CustomerUser>;
  register: (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    marketingConsent?: boolean,
  ) => Promise<CustomerUser>;
  registerFromOrder: (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    marketingConsent?: boolean,
  ) => Promise<CustomerUser>;
  logout: () => void;
  setPendingAction: (action: PendingAction | null) => void;
  replayPendingAction: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ allowAnonymous = true, children }: { allowAnonymous?: boolean; children: ReactNode }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingActionState] = useState<PendingAction | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const token = getAuthToken();
    const stored = getStoredCustomer();
    if (token && stored) {
      setCustomer(stored as CustomerUser);
    }
    setIsLoading(false);
  }, []);

  // Listen for auth-expired events dispatched by fetchJson on 401 responses.
  // Auto-logout and redirect to the store's login page.
  useEffect(() => {
    function onAuthExpired() {
      clearAuthToken();
      setCustomer(null);
      setPendingActionState(null);
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/account/login?redirect=${redirect}`;
    }
    window.addEventListener("tc-auth-expired", onAuthExpired);
    return () => window.removeEventListener("tc-auth-expired", onAuthExpired);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiLogin(email, password);
      setCustomer(data.user);
      return data.user as CustomerUser;
    },
    [],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      phone?: string,
      marketingConsent?: boolean,
    ) => {
      const data = await apiRegister(email, password, fullName, phone, marketingConsent, generateIdempotencyKey());
      setCustomer(data.user);
      return data.user as CustomerUser;
    },
    [],
  );

  const registerFromOrder = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      phone?: string,
      marketingConsent?: boolean,
    ) => {
      const data = await apiRegisterFromOrder(email, password, fullName, phone, marketingConsent, generateIdempotencyKey());
      setCustomer(data.user);
      return data.user as CustomerUser;
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuthToken();
    setCustomer(null);
    setPendingActionState(null);
  }, []);

  const setPendingAction = useCallback((action: PendingAction | null) => {
    setPendingActionState(action);
  }, []);

  // Replay the pending action after successful auth.
  // The actual replay logic lives in cart/wishlist providers via a custom event,
  // because they own the mutation functions and query cache.
  const replayPendingAction = useCallback(() => {
    if (!pendingAction) return;
    // Emit a custom event that cart/wishlist providers listen for.
    window.dispatchEvent(new CustomEvent("tc-replay-pending", { detail: pendingAction }));
    setPendingActionState(null);
  }, [pendingAction]);

  return (
    <Ctx.Provider
      value={{
        customer,
        isAuthenticated: !!customer,
        isLoading,
        pendingAction,
        allowAnonymous,
        login,
        register,
        registerFromOrder,
        logout,
        setPendingAction,
        replayPendingAction,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
