import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Pwa } from "./Pwa";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ons Zoo Dagboek",
  description: "Plan, ontdek en bewaar iedere dierendate samen.",
  themeColor: "#40513d",
  appleWebApp: {
    capable: true,
    title: "Zoo Dagboek",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon-64-v2.png", sizes: "64x64", type: "image/png" },
      { url: "/app-icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/app-icon-192-v2.png",
    apple: [
      { url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "apple-touch-icon-precomposed", url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Pwa />{children}
      </body>
    </html>
  );
}
