import type { Solution } from "@/lib/solutions";
import { siteUrl } from "@/lib/siteUrl";

export function getSolutionPageJsonLd(solution: Solution) {
  const BASE_URL = siteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: `Office Manager — ${solution.title}`,
        url: `${BASE_URL}/solutions/${solution.slug}`,
        image: `${BASE_URL}/opengraph-image.png`,
        description: solution.summary,
        category: "Business Application",
        brand: { "@type": "Brand", name: "Office Manager" },
        areaServed: "Kenya",
        offers: {
          "@type": "AggregateOffer",
          lowPrice: "3500",
          highPrice: "8000",
          priceCurrency: "KES",
          offerCount: "2",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Solutions", item: `${BASE_URL}#features` },
          { "@type": "ListItem", position: 3, name: solution.title, item: `${BASE_URL}/solutions/${solution.slug}` },
        ],
      },
    ],
  };
}
