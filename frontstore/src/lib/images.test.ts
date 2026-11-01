import { describe, expect, it } from "vitest";
import { thumbUrl } from "./images";

describe("thumbUrl", () => {
  it("maps relative upload URLs to their thumbnail", () => {
    expect(thumbUrl("/uploads/abc123.png")).toBe("/uploads/thumbs/abc123.png.jpg");
    expect(thumbUrl("/uploads/abc123.JPEG")).toBe("/uploads/thumbs/abc123.JPEG.jpg");
  });

  it("keeps the origin of absolute upload URLs", () => {
    expect(thumbUrl("https://shop.example.com/uploads/a.webp")).toBe(
      "https://shop.example.com/uploads/thumbs/a.webp.jpg"
    );
  });

  it("leaves non-upload and already-thumbnail URLs alone", () => {
    expect(thumbUrl("https://images.unsplash.com/photo-1.jpg")).toBe("https://images.unsplash.com/photo-1.jpg");
    expect(thumbUrl("/uploads/thumbs/a.png.jpg")).toBe("/uploads/thumbs/a.png.jpg");
    expect(thumbUrl("/uploads/doc.pdf")).toBe("/uploads/doc.pdf");
    expect(thumbUrl("/images/hero.jpg")).toBe("/images/hero.jpg");
  });

  it("passes through empty values", () => {
    expect(thumbUrl(undefined)).toBeUndefined();
    expect(thumbUrl(null)).toBeUndefined();
    expect(thumbUrl("")).toBe("");
  });
});
