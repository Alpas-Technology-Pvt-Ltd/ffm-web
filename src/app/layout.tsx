import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Field Force Management",
  description: "Supervisor Real-Time Network Sync",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className={`${inter.className} min-h-full flex flex-col bg-slate-900`}>{children}</body>
    </html>
  );
}
