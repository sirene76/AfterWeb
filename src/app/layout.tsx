import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ReactNode } from "react";

import { AppSessionProvider } from "@/components/AppSessionProvider";
import { NavBar } from "@/components/nav-bar";
import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AfterWeb",
  description: "Upload, analyze, and deploy your legacy websites with AfterWeb.",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-neutral-950 text-zinc-100 antialiased`}
      >
        <AppSessionProvider>
          <NavBar />
          {children}
        </AppSessionProvider>
      </body>
    </html>
  );
}
