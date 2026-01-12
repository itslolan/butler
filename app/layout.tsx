import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://adphex.com'),
  title: {
    default: "Adphex - ChatGPT for Your Finances | AI-Powered Financial Assistant for Expense Tracking & Budgeting",
    template: "%s | Adphex"
  },
  description: "Get trusted answers about your finances with AI-powered analysis. Upload bank statements, track expenses, and get personalized financial insights. Save more money with Adphex's intelligent duplicate detection, automated categorization, and interactive financial dashboards.",
  keywords: [
    "financial assistant",
    "expense tracker",
    "bank statement analyzer",
    "AI finance",
    "personal finance",
    "budget tracker",
    "financial insights",
    "money management",
    "expense analysis",
    "financial health"
  ],
  authors: [{ name: "Adphex" }],
  creator: "Adphex",
  publisher: "Adphex",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Adphex",
    title: "Adphex - ChatGPT for Your Finances | AI-Powered Financial Assistant",
    description: "Get trusted answers about your finances with AI-powered analysis. Upload bank statements, track expenses, and get personalized financial insights.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Adphex - AI-Powered Financial Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Adphex - ChatGPT for Your Finances",
    description: "Get trusted answers about your finances with AI-powered analysis. Upload bank statements and get personalized insights.",
    images: ["/og-image.png"],
    creator: "@adphex",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes here when available
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
  category: "Finance",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  other: {
    "theme-color": "#2563eb",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
        {/* 100% privacy-first analytics */}
        <Script 
          src="https://scripts.simpleanalyticscdn.com/latest.js" 
          data-collect-dnt="true" 
        />
      </body>
    </html>
  );
}
