// Storefront homepage copy shared by the classic (LandingHome) and minimal
// (LandingMinimal) landing pages, so both variants stay in sync.
import { ShoppingBag, ClipboardCheck, ChefHat } from "lucide-react";

export const testimonials = [
  {
    quote:
      "The chicken is unbelievably fresh and clean — I no longer worry about hygiene while cooking. The cuts are neat, tender, and perfect for everyday dishes.",
    name: "Kavitha R.",
    role: "Home cook, weekly customer",
  },
  {
    quote:
      "As someone who focuses on healthy eating, this is my go-to. Hormone-free, machine-cut, always perfectly packed — you can see the difference in freshness and taste.",
    name: "Rahul M.",
    role: "Nutrition coach",
  },
  {
    quote:
      "Delivery is always on time and properly chilled. Orders arrive exactly as promised — a genuinely reliable partner for our family meals.",
    name: "Mohammed S.",
    role: "Regular since day one",
  },
];

export const knownFor = [
  {
    title: "Freshness you can always trust",
    text: "Pure, safe and hygienic chicken — every single order.",
  },
  {
    title: "Hygiene beyond every standard",
    text: "Cleanly processed, freshly packed, carefully delivered.",
  },
  {
    title: "Perfectly fresh, every single time",
    text: "Consistent quality you can actually taste.",
  },
  {
    title: "From farm to your table",
    text: "Short supply chains, honest sourcing, reliable delivery.",
  },
  {
    title: "A healthier choice for every home",
    text: "Hormone-free chicken, handled the way it should be.",
  },
  {
    title: "Trusted by cooks, loved by families",
    text: "The everyday staple that never lets a kitchen down.",
  },
];

export const steps = [
  {
    icon: ShoppingBag,
    index: "01",
    title: "Choose your cuts",
    text: "Browse fresh and frozen chicken and add what you need to your basket.",
  },
  {
    icon: ClipboardCheck,
    index: "02",
    title: "Review delivery at checkout",
    text: "See the delivery options and timings available for your address before you pay.",
  },
  {
    icon: ChefHat,
    index: "03",
    title: "Get cooking",
    text: "Your chicken arrives ready for the fridge or freezer — dinner starts here.",
  },
];

export const faqs = [
  {
    q: "Should I choose fresh or frozen?",
    a: "Fresh chicken suits cooking within the next day or two — follow the use-by date on the pack. Frozen is ideal for planning ahead: it keeps longer in the freezer and can be thawed in the fridge when you need it.",
  },
  {
    q: "Do you deliver to my area?",
    a: "Add your items to the basket and review delivery options at checkout — available methods, timings and any fees for your address are confirmed there before you pay.",
  },
  {
    q: "How should I handle chicken at home?",
    a: "Keep chicken chilled, follow the use-by date and storage guidance on the pack, thaw frozen chicken in the fridge, and cook thoroughly until the juices run clear and there is no pink meat.",
  },
];
