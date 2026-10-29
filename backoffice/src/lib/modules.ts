import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StoreModule } from "@/types";

export const MODULES_QUERY_KEY = ["store-modules"];

/**
 * Store module / feature flags (Developer → Modules & Features).
 * Fail-open: while loading or on error every module reports enabled, so a
 * flaky request never hides navigation. An absent code is treated as enabled.
 */
export function useModules() {
  const q = useQuery({
    queryKey: MODULES_QUERY_KEY,
    queryFn: () => api.listModules(),
    staleTime: 30_000,
  });

  const enabled = useMemo(() => q.data?.modules ?? null, [q.data]);

  return {
    modules: (q.data?.items ?? []) as StoreModule[],
    isLoading: q.isLoading,
    isEnabled: (code: string) => enabled == null || enabled[code] !== false,
  };
}
