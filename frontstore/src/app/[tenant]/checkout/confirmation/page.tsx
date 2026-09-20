"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FullPageLoader } from "@/components/Loaders";

function ConfirmationRedirect({ tenant }: { tenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    // Redirect to the new success page
    const dest = orderId
      ? `/${tenant}/checkout/success?orderId=${orderId}`
      : `/${tenant}/checkout/success`;
    router.replace(dest);
  }, [router, tenant, orderId]);

  return <FullPageLoader label="Redirecting" />;
}

export default function OldConfirmationPage({ params }: { params: { tenant: string } }) {
  return (
    <Suspense fallback={<FullPageLoader label="Loading" />}>
      <ConfirmationRedirect tenant={params.tenant} />
    </Suspense>
  );
}
