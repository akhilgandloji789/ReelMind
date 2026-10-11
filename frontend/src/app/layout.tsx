import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "The ReelMind Chronicle - Verbatim Multilingual Reel & Short-Form Transcription",
  description: "The authoritative broadsheet for transcription, code-switching analysis, and synchronized reel dispatches.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ReelMind",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-full bg-[#f6f4ee] text-[#111111] font-serif antialiased selection:bg-[#111111] selection:text-[#f6f4ee]">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
