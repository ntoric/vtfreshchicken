import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Currency, Product } from "@/types";

const addItem = vi.fn();
const toggleItem = vi.fn();
vi.mock("@/lib/cart", () => ({ useCart: () => ({ addItem }) }));
vi.mock("@/lib/wishlist", () => ({ useWishlist: () => ({ isInWishlist: () => false, toggleItem }) }));
vi.mock("@/lib/bootstrap", () => ({
  useBootstrap: () => ({ categories: [{ slug: "fresh-chicken", name: "Fresh Chicken" }] }),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ alt, fill, ...props }: { alt: string; fill?: boolean; [k: string]: unknown }) => <img alt={alt} {...props} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { ProductCard } from "./ProductCard";

const inr = { code: "INR", symbol: "₹", decimals: 2 } as unknown as Currency;

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "chicken-breast",
    name: "Chicken Breast (Boneless)",
    category_slug: "fresh-chicken",
    base_price: 9.49,
    effective_price: 789.57,
    rating: 4.7,
    stock: 0,
    is_featured: false,
    image_url: "/img.jpg",
    attributes: [{ attribute_slug: "storage", option_label: "Chilled (0–4°C)" }],
    variants: [
      { id: "v500", name: "500 g", price: 415.17, stock: 30, is_active: true },
      { id: "v1", name: "1 kg", price: 789.57, stock: 30, is_active: true },
      { id: "v2", name: "2 kg", price: 1538.37, stock: 0, is_active: true },
    ],
    ...overrides,
  } as unknown as Product;
}

describe("ProductCard", () => {
  beforeEach(() => {
    addItem.mockClear();
    toggleItem.mockClear();
  });

  it("links to the product and shows category name, rating and storage tag", () => {
    render(<ProductCard product={product()} currency={inr} />);
    expect(screen.getByRole("link", { name: "Chicken Breast (Boneless)" })).toHaveAttribute("href", "/products/chicken-breast");
    expect(screen.getByText("Fresh Chicken")).toBeInTheDocument();
    expect(screen.getByText("4.7")).toBeInTheDocument();
    expect(screen.getByText("Chilled")).toBeInTheDocument();
  });

  it("defaults to the first in-stock size and updates the price on selection", () => {
    render(<ProductCard product={product()} currency={inr} />);
    expect(screen.getByRole("radio", { name: "500 g" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/415\.17/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "1 kg" }));
    expect(screen.getByRole("radio", { name: "1 kg" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/789\.57/)).toBeInTheDocument();
  });

  it("disables out-of-stock sizes", () => {
    render(<ProductCard product={product()} currency={inr} />);
    expect(screen.getByRole("radio", { name: "2 kg" })).toBeDisabled();
  });

  it("adds the selected size at its price", () => {
    render(<ProductCard product={product()} currency={inr} />);
    fireEvent.click(screen.getByRole("radio", { name: "1 kg" }));
    fireEvent.click(screen.getByRole("button", { name: /add chicken breast.*1 kg.*to cart/i }));
    expect(addItem).toHaveBeenCalledWith("p1", "v1", 1, 789.57, "INR");
  });

  it("applies the offer percentage to the selected size", () => {
    render(<ProductCard product={product({ discounted_price: 631.66, discount_pct: 20 })} currency={inr} />);
    expect(screen.getByText("20% off")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add .* to cart/i }));
    expect(addItem.mock.calls[0][3]).toBeCloseTo(415.17 * 0.8, 2);
  });

  it("single-size products show pack size and add without a variant", () => {
    render(
      <ProductCard
        product={product({ variants: [], stock: 3, attributes: [{ attribute_slug: "pack-size", option_label: "1 kg" } as never] })}
        currency={inr}
      />
    );
    expect(screen.getByText("1 kg pack")).toBeInTheDocument();
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add .* to cart/i }));
    expect(addItem).toHaveBeenCalledWith("p1", undefined, 1, 789.57, "INR");
  });

  it("shows sold out and blocks adding when nothing is in stock", () => {
    render(<ProductCard product={product({ variants: [], stock: 0 })} currency={inr} />);
    expect(screen.getAllByText("Sold out").length).toBeGreaterThan(0);
    const btn = screen.getByRole("button", { name: "Sold out" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(addItem).not.toHaveBeenCalled();
  });

  it("wishlist toggle is a separate control", () => {
    render(<ProductCard product={product()} currency={inr} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to wishlist" }));
    expect(toggleItem).toHaveBeenCalledWith("p1");
  });
});
