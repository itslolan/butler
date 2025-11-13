import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Health Tracker",
  description: "Track your expenses and financial health with AI-powered analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

