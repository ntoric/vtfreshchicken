/**
 * Card-size thumbnails for uploaded images.
 *
 * The backend writes a compressed JPEG (≤640px) next to every upload at
 * `/uploads/thumbs/<filename>.jpg` — and generates it on first request for
 * images uploaded before thumbnails existed. Product cards, lists, cart and
 * wishlist use these; the full original is only loaded on the product detail
 * page (and its full-screen viewer).
 *
 * URLs that are not backend uploads (external CDNs, static assets) are
 * returned unchanged.
 */
const UPLOAD_RE = /^((?:https?:)?\/\/[^/]+)?\/uploads\/([^/?#]+\.(?:jpe?g|png|webp|gif))([?#].*)?$/i;

export function thumbUrl(url: string): string;
export function thumbUrl(url: string | null | undefined): string | undefined;
export function thumbUrl(url: string | null | undefined): string | undefined {
  if (!url) return url ?? undefined;
  const m = UPLOAD_RE.exec(url);
  if (!m) return url;
  const [, origin = "", filename] = m;
  return `${origin}/uploads/thumbs/${filename}.jpg`;
}
