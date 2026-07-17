import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "CreativePhotoEditor — free browser photo editor",
  description:
    "A free, browser-first photo editor. Layers, move, resize, blend modes and export — no install, your images never leave your device.",
  keywords: ["photo editor", "free photo editor", "image editor", "layers", "browser editor"],
};

export const viewport: Viewport = {
  themeColor: "#101216",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
