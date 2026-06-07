import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Anonvey — Truly Anonymous",
  description:
    "Anonvey runs truly anonymous employee surveys for organisations. Anonymity is built into the data — even we can't see your results.",
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
