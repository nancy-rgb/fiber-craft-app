import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { StoreHydrator } from "@/components/StoreHydrator";
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
  title: "Fiber Craft",
  description:
    "Vibes-first pattern engine for drop-shoulder sweaters and amigurumi.",
  applicationName: "Fiber Craft",
  appleWebApp: {
    capable: true,
    title: "Fiber Craft",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StoreHydrator />
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Fiber Craft
            </Link>
          </header>
          <main className="flex-1 px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
