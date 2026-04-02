import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Build AI",
  description: "Internal operations platform for deployment hardware tracking, logistics, QR packaging, and SD card ingestion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" style={{ background: "#ffffff" }}>
      <body style={{ height: "100%", background: "#ffffff", color: "#111111" }}>
        {children}
      </body>
    </html>
  );
}
