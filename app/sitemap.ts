import type { MetadataRoute } from "next";

const SITE = "https://anonvey.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/register`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
