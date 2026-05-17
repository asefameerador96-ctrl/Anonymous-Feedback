import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Anonymous Feedback",
  description: "A safe space to share your honest perspective.",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
