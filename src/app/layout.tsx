import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moto Ops Control",
  description:
    "Operations dashboard for deployment requests, shipment tracking, return handling, and SD card ingestion flow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
