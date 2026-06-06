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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), camera=(), microphone=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
