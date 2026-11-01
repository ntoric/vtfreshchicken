import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./page";
import { HomeVariant, resolveLandingVariant } from "@/components/landing/HomeVariant";
import { LandingSkeleton } from "@/components/landing/LandingSkeleton";
import { LandingHome } from "@/components/LandingHome";
import { LandingMinimal } from "@/components/LandingMinimal";
import { LandingMalayalam } from "@/components/LandingMalayalam";
import type { BootstrapResponse } from "@/types";
import { BootstrapProvider } from "@/lib/bootstrap";

const fetchBootstrapMock = vi.fn<() => Promise<BootstrapResponse>>();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchBootstrap: () => fetchBootstrapMock(),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const renderHome = () => renderWithClient(<LandingHome />);

// next/font only works under the Next compiler; stub every Google font loader.
vi.mock("next/font/google", () =>
  new Proxy({}, { get: () => () => ({ className: "", style: { fontFamily: "" } }) })
);

vi.mock("next/image", () => ({
  default: ({ alt, fill, priority, ...props }: { alt: string; fill?: boolean; priority?: boolean; [k: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img alt={alt} data-fill={fill ? "true" : undefined} data-priority={priority ? "true" : undefined} {...props} />;
  },
}));

// The real Header needs the auth/cart providers from StorefrontShell; it only
// renders when bootstrap is present and isn't under test here.
vi.mock("@/components/Header", () => ({ Header: () => null }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>{children}</a>
  ),
}));

describe("Classic landing page", () => {
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

describe("Minimal landing page", () => {
  const renderMinimal = () => renderWithClient(<LandingMinimal />);

  it("renders a single chicken-focused h1", () => {
    renderMinimal();
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toMatch(/chicken/i);
  });

  it("primary CTA links to /shop", async () => {
    renderMinimal();
    expect(screen.getByRole("link", { name: /shop now/i })).toHaveAttribute("href", "/shop");
    expect(await screen.findByRole("link", { name: /start shopping/i })).toHaveAttribute("href", "/shop");
  });

  it("range tiles link to shop searches", () => {
    renderMinimal();
    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/shop?search=fresh", "/shop?search=frozen", "/shop?search=chicken"]));
  });

  it("all local # anchors resolve and images have alt text", () => {
    const { container } = renderMinimal();
    container.querySelectorAll('a[href^="#"]').forEach((a) => {
      const id = a.getAttribute("href")!.slice(1);
      expect(container.querySelector(`#${id}`), `missing #${id}`).not.toBeNull();
    });
    // Decorative images (e.g. the BrandLogo mark next to the store name) use alt="".
    const meaningful = Array.from(container.querySelectorAll("img")).filter(
      (img) => img.getAttribute("alt") !== "" && img.getAttribute("aria-hidden") !== "true"
    );
    expect(meaningful.length).toBeGreaterThanOrEqual(4);
    meaningful.forEach((img) => {
      expect(img.getAttribute("alt")!.length).toBeGreaterThan(10);
    });
  });
});

describe("Minimal landing page — content sections", () => {
  it("keeps the lower half as a skeleton until it is scrolled near", () => {
    // An observer that never reports an intersection = user hasn't scrolled.
    const observe = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = observe;
        disconnect() {}
        unobserve() {}
      }
    );
    try {
      renderWithClient(<LandingMinimal />);
      expect(observe).toHaveBeenCalled();
      expect(screen.getByLabelText(/loading more/i)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /three steps to dinner/i })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  const renderMinimal = () => renderWithClient(<LandingMinimal />);

  it("lazily renders how-it-works, why-us, testimonials and FAQ sections", async () => {
    renderMinimal();
    for (const name of [/three steps to dinner/i, /handled the way it should be/i, /what our customers say/i, /good to know/i]) {
      expect(await screen.findByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { level: 3, name: /choose your cuts/i })).toBeInTheDocument();
  });

  it("FAQ uses native disclosure elements", async () => {
    const { container } = renderMinimal();
    await screen.findByRole("heading", { name: /good to know/i });
    const summaries = container.querySelectorAll("details > summary");
    expect(summaries.length).toBeGreaterThanOrEqual(3);
  });

  it("lists active branches with their areas, capped with a +N more chip", async () => {
    const areas = Array.from({ length: 10 }, (_, i) => `Area ${i + 1}`);
    const bootstrap = {
      settings: {},
      currencies: [],
      languages: [],
      categories: [],
      attributes: [],
      branches: [
        { id: "b1", name: "Kacheripadi Branch", city: "Malappuram", areas, is_active: true },
        { id: "b2", name: "Closed Branch", areas: [], is_active: false },
      ],
    } as unknown as BootstrapResponse;
    renderWithClient(
      <BootstrapProvider bootstrap={bootstrap}>
        <LandingMinimal />
      </BootstrapProvider>
    );
    expect(await screen.findByRole("heading", { name: /where we deliver/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Kacheripadi Branch" })).toBeInTheDocument();
    expect(screen.queryByText("Closed Branch")).toBeNull();
    expect(screen.getByText("Area 8")).toBeInTheDocument();
    expect(screen.queryByText("Area 9")).toBeNull();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("hides the delivery-areas section when there is no bootstrap/branches", async () => {
    renderMinimal();
    await screen.findByRole("heading", { name: /good to know/i });
    expect(screen.queryByRole("heading", { name: /where we deliver/i })).toBeNull();
  });
});

describe("Home variant selection", () => {
  const bootstrapWith = (landing_variant?: string) =>
    ({ settings: { landing_variant } }) as unknown as BootstrapResponse;

  it("resolves the configured variant, defaulting to classic", () => {
    expect(resolveLandingVariant(bootstrapWith("minimal"))).toBe("minimal");
    expect(resolveLandingVariant(bootstrapWith("malayalam"))).toBe("malayalam");
    expect(resolveLandingVariant(bootstrapWith("classic"))).toBe("classic");
    expect(resolveLandingVariant(bootstrapWith(undefined))).toBe("classic");
    expect(resolveLandingVariant(bootstrapWith("unknown"))).toBe("classic");
    expect(resolveLandingVariant(null)).toBe("classic");
  });

  it("HomeVariant still renders when bootstrap fails", async () => {
    fetchBootstrapMock.mockRejectedValueOnce(new Error("down"));
    await expect(HomeVariant()).resolves.toBeTruthy();
  });

  it("the page streams a skeleton first via Suspense", () => {
    const el = Home();
    expect(el.props.fallback.type).toBe(LandingSkeleton);
  });
});

describe("Malayalam landing page", () => {
  const renderMl = () => renderWithClient(<LandingMalayalam />);

  it("marks the page as Malayalam and renders a single Malayalam h1", () => {
    const { container } = renderMl();
    expect(container.querySelector('[lang="ml"]')).not.toBeNull();
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain("ചിക്കൻ");
  });

  it("primary CTAs link to /shop", async () => {
    renderMl();
    expect(screen.getByRole("link", { name: /ഇപ്പോൾ ഓർഡർ ചെയ്യൂ/ })).toHaveAttribute("href", "/shop");
    expect(await screen.findByRole("link", { name: /ഷോപ്പിംഗ് തുടങ്ങൂ/ })).toHaveAttribute("href", "/shop");
  });

  it("range tiles link to shop searches", () => {
    renderMl();
    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/shop?search=fresh", "/shop?search=frozen", "/shop?search=chicken"]));
  });

  it("lazily renders the lower sections and a Malayalam footer", async () => {
    const { container } = renderMl();
    for (const name of [/ലളിതമായ മൂന്ന് ഘട്ടങ്ങളിൽ/, /ഞങ്ങളുടെ ഉപഭോക്താക്കൾ പറയുന്നത്/, /അറിഞ്ഞിരിക്കേണ്ടവ/]) {
      expect(await screen.findByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(container.querySelectorAll("details > summary").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/എല്ലാ അവകാശങ്ങളും നിക്ഷിപ്തം/)).toBeInTheDocument();
    expect(screen.queryByText(/All rights reserved/)).toBeNull();
  });

  it("shows branch areas with a Malayalam +N chip", async () => {
    const areas = Array.from({ length: 10 }, (_, i) => `Area ${i + 1}`);
    const bootstrap = {
      settings: {},
      currencies: [],
      languages: [],
      categories: [],
      attributes: [],
      branches: [{ id: "b1", name: "Kacheripadi Branch", city: "Malappuram", areas, is_active: true }],
    } as unknown as BootstrapResponse;
    renderWithClient(
      <BootstrapProvider bootstrap={bootstrap}>
        <LandingMalayalam />
      </BootstrapProvider>
    );
    expect(await screen.findByRole("heading", { name: /ഞങ്ങൾ ഡെലിവർ ചെയ്യുന്ന സ്ഥലങ്ങൾ/ })).toBeInTheDocument();
    expect(screen.getByText("+2 കൂടി")).toBeInTheDocument();
  });
});
