// Frontend payment gateway registry — mirrors the backend registry.
//
// Architecture:
//   Each gateway is a self-contained file in components/payment/ that exports
//   a RegisteredGateway object. The file calls registerGateway() here.
//
// Adding a new gateway:
//   1. Create components/payment/MyGateway.tsx exporting a RegisteredGateway
//   2. Add one line: registerGateway(MyGateway) — right in that file or here
//   3. That's it. The payment page auto-discovers it.
//
// The backend controls which gateways are *available* via GET /payment/methods.
// The frontend registry controls how each gateway *renders* its form.

import type { ReactNode, FC } from "react";
import type { LucideIcon } from "lucide-react";
import type { PaymentDetails } from "@/types";

export interface PaymentGatewayMeta {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  group: string; // "card", "wallet", "bank", "cash", "crypto"
  requires_redirect?: boolean;
}

export interface PaymentComponentProps {
  /** Grand total to pay */
  amount: number;
  /** Currency symbol object for display */
  currencySymbol: string;
  /** Called whenever the gateway's form data changes. Pass null if form is invalid. */
  onDetailsChange: (details: PaymentDetails | null) => void;
  /** Whether the parent is currently submitting the payment */
  isProcessing?: boolean;
}

export interface RegisteredGateway {
  meta: PaymentGatewayMeta;
  /** React component that renders the gateway-specific payment form */
  Component: FC<PaymentComponentProps>;
}

// ---- Registry ----
const registry = new Map<string, RegisteredGateway>();

export function registerGateway(g: RegisteredGateway): void {
  registry.set(g.meta.id, g);
}

export function getGateway(id: string): RegisteredGateway | undefined {
  return registry.get(id);
}

export function listGateways(): RegisteredGateway[] {
  return Array.from(registry.values());
}

// ---- Register built-in gateways ----
// Each import has the side effect of registering the gateway.
import { CardGateway } from "@/components/payment/CardGateway";
import { PaypalGateway } from "@/components/payment/PaypalGateway";
import { CodGateway } from "@/components/payment/CodGateway";
import { RazorpayGateway } from "@/components/payment/RazorpayGateway";
import { WalletGateway } from "@/components/payment/WalletGateway";

registerGateway(CardGateway);
registerGateway(PaypalGateway);
registerGateway(CodGateway);
registerGateway(RazorpayGateway);
registerGateway(WalletGateway);
