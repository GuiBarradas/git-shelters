import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

import { AudioProvider } from "@/components/audio/AudioProvider";
import { AudioToggle } from "@/components/audio/AudioToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0B0713] text-[#E6DFC8]">
        <AudioProvider>
          {children}
          <footer className="pointer-events-auto fixed bottom-2 right-4 z-10 font-mono text-[10px] uppercase tracking-widest text-[#E6DFC8]/40">
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
