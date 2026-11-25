import type { Metadata } from "next";
import type { Guide } from "./guides";
import { siteUrl } from "./siteUrl";

const BASE_URL = siteUrl();

/** Shared metadata for a static guide page. */
export function guideMetadata(guide: Guide): Metadata {
  const url = `${BASE_URL}/resources/${guide.slug}`;

  return {
    title: `${guide.title} | Office Manager`,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "Office Manager",
      title: guide.title,
      description: guide.description,
      locale: "en_KE",
      publishedTime: guide.updated,
      modifiedTime: guide.updated,
      images: [
        {
          url: `${BASE_URL}/opengraph-image.png`,
          width: 1200,
          height: 630,
          alt: guide.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
      images: [`${BASE_URL}/opengraph-image.png`],
    },
  };
}
