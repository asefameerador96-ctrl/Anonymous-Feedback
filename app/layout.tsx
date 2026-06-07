import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, JetBrains_Mono } from "next/font/google";

// Self-hosted, optimised fonts (no render-blocking @import, no layout shift).
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const sans = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const SITE = "https://anonvey.com";
const DESCRIPTION =
  "Anonvey runs truly anonymous employee surveys for organisations — engagement, culture and manager 360s. Anonymity is built into the data architecture, so even we can't see your results.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Anonvey — Truly Anonymous Employee Surveys",
    template: "%s · Anonvey",
  },
  description: DESCRIPTION,
  applicationName: "Anonvey",
  keywords: [
    "anonymous survey",
    "anonymous employee survey",
    "employee feedback tool",
    "engagement survey",
    "manager 360 feedback",
    "company culture survey",
    "pulse survey",
    "anonymous feedback software",
  ],
  authors: [{ name: "Anonvey" }],
  creator: "Anonvey",
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Anonvey",
    title: "Anonvey — Truly Anonymous Employee Surveys",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Anonvey — Truly Anonymous Employee Surveys",
    description: DESCRIPTION,
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf8f4",
  colorScheme: "light",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Anonvey",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE,
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>
        <div className="relative z-10 min-h-screen">{children}</div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </body>
    </html>
  );
}
