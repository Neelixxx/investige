import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

const brandink = localFont({
  src: "../../BrandinkSansLight-MV4mr.otf",
  variable: "--font-brandink",
  display: "swap",
});

const brandinkDisplay = localFont({
  src: "../../BrandinkSans-rgOpA.otf",
  variable: "--font-brandink-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Investige | Pokemon TCG Analytics",
  description:
    "Track PSA and TAG gem rates, set values, market history, liquidity, arbitrage, and personal collection performance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${brandink.variable} ${brandinkDisplay.variable}`}>
        {children}
      </body>
    </html>
  );
}
