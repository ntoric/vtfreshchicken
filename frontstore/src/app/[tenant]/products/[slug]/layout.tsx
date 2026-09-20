import type { Metadata } from "next";
import { fetchProduct } from "@/lib/api";

export async function generateMetadata({
  params,
}: {
  params: { tenant: string; slug: string };
}): Promise<Metadata> {
  try {
    const { product } = await fetchProduct(params.tenant, params.slug);
    const title = product.meta_title || product.name;
    const description = product.meta_description || product.description?.slice(0, 160) || "";
    const ogImage = product.og_image || product.image_url || (product.images?.[0]?.url ?? undefined);
    const productUrl = `/${params.tenant}/products/${params.slug}`;

    return {
      title,
      description,
      alternates: {
        canonical: productUrl,
      },
      openGraph: {
        type: "website",
        title,
        description,
        url: productUrl,
        images: ogImage ? [{ url: ogImage, alt: product.name }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ogImage ? [ogImage] : undefined,
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {};
  }
}

export default function ProductSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
