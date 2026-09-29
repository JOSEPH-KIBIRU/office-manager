import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";
import WhatsAppWidget from "@/components/WhatsAppWidget";
import CookieConsent from "@/components/CookieConsent";
import MotionProvider from "@/components/MotionProvider";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter", preload: false });

export const metadata: Metadata = {
  title: "Office Manager",
  description: "Office management system — leave, car logs, petty cash, meetings and minutes",
  manifest: "/manifest.webmanifest",
  applicationName: "Office Manager",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Office Manager",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#06142F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE">
      <body className={`${inter.variable} font-sans antialiased`}>
        <MotionProvider>
          {children}
          <WhatsAppWidget />
        </MotionProvider>
        <CookieConsent />
      </body>
      <PwaRegister />
    </html>
  );
}
