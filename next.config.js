/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework in response headers
  poweredByHeader: false,

  // Emit a self-contained server (.next/standalone) for a small Docker image.
  output: "standalone",

  // Load the Postgres driver from node_modules at runtime instead of bundling
  // it (pg pulls in optional native/edge shims that don't need bundling).
  experimental: {
    serverComponentsExternalPackages: ["pg"],
  },

  // Security/privacy headers applied to every route. These used to live in
  // vercel.json, which only works on Vercel — defining them here keeps them
  // working when self-hosted on Azure App Service (or anywhere else).
  async headers() {
    const security = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "Permissions-Policy",
        value: "geolocation=(), camera=(), microphone=()",
      },
    ];
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      // Security headers everywhere
      { source: "/:path*", headers: security },
      // Keep private/app routes out of search indexes; marketing pages
      // (/, /register) stay indexable so the platform can be found.
      { source: "/admin/:path*", headers: noindex },
      { source: "/owner/:path*", headers: noindex },
      { source: "/survey", headers: noindex },
      { source: "/respond", headers: noindex },
      { source: "/thank-you", headers: noindex },
      { source: "/api/:path*", headers: noindex },
    ];
  },
};

module.exports = nextConfig;
