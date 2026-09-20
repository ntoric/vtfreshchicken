import { createContext, useContext, useState, type ReactNode } from "react";
import type { User } from "@/types";
import { getStoredUser, setStoredUser, clearAuth, setToken, getLang, setLang as persistLang } from "@/lib/api";

interface AuthCtx {
  user: User | null;
  tenant: string;
  tenantName: string;
  lang: string;
  setTenant: (t: string) => void;
  setTenantName: (n: string) => void;
  setLang: (l: string) => void;
  login: (user: User, token: string, tenant?: string, tenantName?: string) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);
const TENANT_KEY = "tc_tenant";
const TENANT_NAME_KEY = "tc_tenant_name";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [tenant, setTenantState] = useState<string>(localStorage.getItem(TENANT_KEY) || "demo");
  const [tenantName, setTenantNameState] = useState<string>(localStorage.getItem(TENANT_NAME_KEY) || "");
  const [lang, setLangState] = useState<string>(getLang());

  const setTenant = (t: string) => {
    localStorage.setItem(TENANT_KEY, t);
    setTenantState(t);
  };

  const setTenantName = (n: string) => {
    localStorage.setItem(TENANT_NAME_KEY, n);
    setTenantNameState(n);
  };

  const setLang = (l: string) => {
    persistLang(l);
    setLangState(l);
  };

  const login = (u: User, token: string, t?: string, tn?: string) => {
    setUser(u);
    setStoredUser(u);
    setToken(token);
    if (t) setTenant(t);
    if (tn) setTenantName(tn);
  };

  const logout = () => {
    setUser(null);
    clearAuth();
  };

  return (
    <Ctx.Provider value={{ user, tenant, tenantName, lang, setTenant, setTenantName, setLang, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
