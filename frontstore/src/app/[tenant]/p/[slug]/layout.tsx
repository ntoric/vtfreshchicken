import type { Metadata } from "next";
import { fetchStorePage } from "@/lib/api";

export async function generateMetadata({
  params,
}: {
  params: { tenant: string; slug: string };
}): Promise<Metadata> {
  try {
    const page = await fetchStorePage(params.tenant, params.slug);
    const title = page.meta_title || page.title || params.slug;
    const description = page.meta_description || "";
    const pageUrl = `/${params.tenant}/p/${params.slug}`;

    return {
      title,
      description,
      alternates: {
        canonical: pageUrl,
      },
      openGraph: {
        type: "website",
        title,
        description,
        url: pageUrl,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
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

export default function StorePageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
