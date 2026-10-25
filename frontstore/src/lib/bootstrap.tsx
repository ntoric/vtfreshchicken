"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BootstrapResponse } from "@/types";

const Ctx = createContext<BootstrapResponse | null>(null);

export function BootstrapProvider({
  bootstrap,
  children,
}: {
  bootstrap: BootstrapResponse;
  children: ReactNode;
}) {
  return <Ctx.Provider value={bootstrap}>{children}</Ctx.Provider>;
}

/** Bootstrap payload fetched once server-side in the root layout. Null outside StorefrontShell. */
export function useBootstrap() {
  return useContext(Ctx);
}
