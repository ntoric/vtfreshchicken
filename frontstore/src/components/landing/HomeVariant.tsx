import { fetchBootstrap } from "@/lib/api";
import type { BootstrapResponse, LandingVariant } from "@/types";
import { LandingSwitch } from "./LandingSwitch";

/** Active homepage design (Backoffice → Developer → Landing Page); classic by default. */
export function resolveLandingVariant(bootstrap: BootstrapResponse | null | undefined): LandingVariant {
  return bootstrap?.settings?.landing_variant === "minimal" ? "minimal" : "classic";
}

/**
 * Async server component: resolves the variant from bootstrap (deduped with
 * the root layout's call via the Next data cache) and renders that design.
 * Wrapped in <Suspense fallback={<LandingSkeleton />}> by the page so the
 * skeleton streams first whenever this has to wait.
 */
export async function HomeVariant() {
  let bootstrap: BootstrapResponse | null = null;
  try {
    bootstrap = await fetchBootstrap();
  } catch {
    // Root layout already renders the "store unavailable" fallback.
  }
  return <LandingSwitch variant={resolveLandingVariant(bootstrap)} />;
}
