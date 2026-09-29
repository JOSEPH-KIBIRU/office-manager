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
        description: solution.summary,
        category: "Business Application",
        brand: { "@type": "Brand", name: "Office Manager" },
        areaServed: "Kenya",
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
