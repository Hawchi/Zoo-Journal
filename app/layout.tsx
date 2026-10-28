import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Pwa } from "./Pwa";
import { LanguageProvider } from "./i18n";

export const metadata: Metadata = {
  title: "Zoo Journal",
  description: "Plan, ontdek en bewaar iedere dierendate samen.",
  appleWebApp: {
    capable: true,
    title: "Zoo Journal",
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
  manifest: "/manifest.webmanifest?v=3",
};

export const viewport: Viewport = { themeColor: "#40513d" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>
        <LanguageProvider><Pwa />{children}</LanguageProvider>
      </body>
    </html>
  );
}
