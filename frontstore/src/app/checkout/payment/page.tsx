import { redirect } from "next/navigation";

// Payment is now handled inline on the single-page checkout.
// Keep this route as a redirect so stale links/bookmarks still work.
export default function PaymentPage() {
  redirect("/checkout");
}
