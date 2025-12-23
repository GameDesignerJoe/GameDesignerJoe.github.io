import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Steam Scout - Discover Your Next Game",
  description: "Explore and discover hidden gems in your Steam library. Get personalized game recommendations based on your preferences and playtime.",
  icons: {
    icon: {
      url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' stroke='%234299e1' stroke-width='3' fill='%231a202c'/><circle cx='50' cy='50' r='35' stroke='%234299e1' stroke-width='2' fill='none' opacity='0.5'/><path d='M50 15 L58 42 L50 38 L42 42 Z' fill='%23ef4444' stroke='%234299e1' stroke-width='1'/><path d='M50 85 L42 58 L50 62 L58 58 Z' fill='%234299e1'/><circle cx='50' cy='50' r='4' fill='%234299e1'/></svg>",
      type: "image/svg+xml",
    },
  },
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
        {children}
      </body>
    </html>
  );
}
