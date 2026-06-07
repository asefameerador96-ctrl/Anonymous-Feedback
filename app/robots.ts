import type { MetadataRoute } from "next";

const SITE = "https://anonvey.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private app surfaces out of search results.
      disallow: ["/admin", "/owner", "/survey", "/respond", "/thank-you", "/api"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
