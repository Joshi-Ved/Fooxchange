import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Navbar } from "@/components/layout/navbar";
import { PWAProvider } from "@/components/providers/pwa-provider";
import { PWAInstallBanner } from "@/components/pwa/install-banner";
import { PWAUpdateNotification } from "@/components/pwa/update-notification";
import { OfflineIndicator } from "@/components/pwa/offline-indicator";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fooxchange - Community Recipe Exchange",
  description:
    "Never ask 'What to cook today?' again. Exchange recipes with home cooks, discover dishes based on your ingredients, and share your family favorites.",
  keywords: ["recipes", "cooking", "food", "ingredients", "home cooking", "recipe sharing"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fooxchange",
  },
  openGraph: {
    title: "Fooxchange - Community Recipe Exchange",
    description: "Exchange recipes with home cooks and discover dishes based on your ingredients.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

// Separate viewport export (Next.js 16 requirement)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#16a34a" },
    { media: "(prefers-color-scheme: dark)", color: "#15803d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const appShell = (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PWAProvider>
          <Navbar />
          {children}
          <PWAInstallBanner />
          <PWAUpdateNotification />
          <OfflineIndicator />
        </PWAProvider>
      </body>
    </html>
  );

  if (!authEnabled) {
    return appShell;
  }

  return <ClerkProvider>{appShell}</ClerkProvider>;
}
