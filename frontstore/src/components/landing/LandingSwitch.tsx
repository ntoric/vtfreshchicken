"use client";

import dynamic from "next/dynamic";
import type { LandingVariant } from "@/types";
import { LandingSkeleton } from "./LandingSkeleton";

// Each design is its own client chunk, so only the active one is downloaded.
// This must live in a client component: next/dynamic called from a server
// component does not split client components out of the page bundle.
const LandingHome = dynamic(() => import("@/components/LandingHome").then((m) => m.LandingHome), {
  loading: () => <LandingSkeleton />,
});
const LandingMinimal = dynamic(() => import("@/components/LandingMinimal").then((m) => m.LandingMinimal), {
  loading: () => <LandingSkeleton />,
});

const LandingMalayalam = dynamic(() => import("@/components/LandingMalayalam").then((m) => m.LandingMalayalam), {
  loading: () => <LandingSkeleton />,
});

export function LandingSwitch({ variant }: { variant: LandingVariant }) {
  if (variant === "minimal") return <LandingMinimal />;
  if (variant === "malayalam") return <LandingMalayalam />;
  return <LandingHome />;
}
