import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./page";

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>
  );
}

vi.mock("next/image", () => ({
  default: ({ alt, fill, priority, ...props }: { alt: string; fill?: boolean; priority?: boolean; [k: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img alt={alt} data-fill={fill ? "true" : undefined} data-priority={priority ? "true" : undefined} {...props} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>{children}</a>
  ),
}));

describe("Root landing page", () => {
  it("renders a single chicken-focused h1", () => {
    renderHome();
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toMatch(/chicken/i);
  });

  it("primary shop links point to /shop", () => {
    renderHome();
    const shopLinks = screen.getAllByRole("link", { name: /shop chicken/i });
    expect(shopLinks.length).toBeGreaterThanOrEqual(3);
    shopLinks.forEach((l) => {
      expect(l).toHaveAttribute("href", "/shop");
    });
  });

  it("all local # anchors resolve to elements on the page", () => {
    const { container } = renderHome();
    const anchors = Array.from(container.querySelectorAll('a[href^="#"]'));
    expect(anchors.length).toBeGreaterThan(0);
    anchors.forEach((a) => {
      const id = a.getAttribute("href")!.slice(1);
      expect(container.querySelector(`#${id}`), `missing #${id}`).not.toBeNull();
    });
  });

  it("range cards link to correct shop searches", () => {
    renderHome();
    const expected: Record<string, string> = {
      "Fresh chicken": "/shop?search=fresh",
      "Frozen favourites": "/shop?search=frozen",
      "Everyday cuts": "/shop?search=chicken",
    };
    const allLinks = screen.getAllByRole("link");
    for (const [name, href] of Object.entries(expected)) {
      const card = allLinks.find((l) => l.getAttribute("href") === href);
      expect(card, `link for ${name}`).toBeDefined();
      expect(card!.textContent).toMatch(new RegExp(name, "i"));
    }
  });

  it("FAQ uses native disclosure elements", () => {
    const { container } = renderHome();
    const details = container.querySelectorAll("details > summary");
    expect(details.length).toBeGreaterThanOrEqual(3);
    // Each summary should be inside a <details> and followed by an answer
    details.forEach((s) => {
      expect(s.tagName).toBe("SUMMARY");
      expect(s.parentElement!.tagName).toBe("DETAILS");
    });
  });

  it("all images have meaningful alt text", () => {
    const { container } = renderHome();
    const images = container.querySelectorAll("img");
    const meaningful = Array.from(images).filter(
      (img) => img.getAttribute("aria-hidden") !== "true"
    );
    expect(meaningful.length).toBeGreaterThanOrEqual(4);
    meaningful.forEach((img) => {
      expect(img.getAttribute("alt")).toBeTruthy();
      expect(img.getAttribute("alt")!.length).toBeGreaterThan(10);
    });
  });

  it("does not reference removed SaaS marketing content", () => {
    const { container } = renderHome();
    expect(container.textContent).not.toMatch(/trucommerce/i);
  });
});
