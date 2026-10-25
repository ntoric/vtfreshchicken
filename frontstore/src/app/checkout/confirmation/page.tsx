"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FullPageLoader } from "@/components/Loaders";

function ConfirmationRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    // Redirect to the new success page
    const dest = orderId
      ? `/checkout/success?orderId=${orderId}`
      : `/checkout/success`;
    router.replace(dest);
  }, [router, orderId]);

  return <FullPageLoader label="Redirecting" />;
}

export default function OldConfirmationPage({ params }: { params: {} }) {
  return (
    <Suspense fallback={<FullPageLoader label="Loading" />}>
      <ConfirmationRedirect />
    </Suspense>
  );
}
