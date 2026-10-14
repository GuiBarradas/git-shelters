import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

import { AudioProvider } from "@/components/audio/AudioProvider";
import { AudioToggle } from "@/components/audio/AudioToggle";
import { BunkerViewport } from "@/components/scene/BunkerViewport";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Pixel face for the numbers that matter and the TopBar wordmark only (art guide §7). */
const silkscreen = localFont({
  src: "../../public/fonts/silkscreen/Silkscreen-Regular.ttf",
  variable: "--font-silkscreen",
});

export const metadata: Metadata = {
  title: "Git Shelters",
  description:
    "Idle/base-builder where your real GitHub activity feeds a post-apocalyptic bunker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${silkscreen.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0B0713] text-[#E6DFC8]">
        <AudioProvider>
          <BunkerViewport>{children}</BunkerViewport>
          <footer className="site-footer pointer-events-auto fixed bottom-2 right-4 z-10 font-mono text-[10px] uppercase tracking-widest text-[#E6DFC8]/40">
            <Link href="/legal/privacy" className="hover:text-[#E6DFC8]">Privacy</Link>
            {" · "}
            <Link href="/legal/terms" className="hover:text-[#E6DFC8]">Terms</Link>
            {" · "}
            <Link href="/settings" className="hover:text-[#E6DFC8]">Settings</Link>
            {" · "}
            <AudioToggle />
          </footer>
        </AudioProvider>
      </body>
    </html>
  );
}
