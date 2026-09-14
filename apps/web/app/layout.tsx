import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import AppShell from "@components/AppShell";
import "../styles/globals.css";

// Self-hosted at build time by next/font, so the app keeps its typeface offline.
const displayFace = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
  axes: ["opsz", "wdth"],
});

const bodyFace = Geist({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const monoFace = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Persona Lab",
  description: "Launch synthetic personas to review your app UI/UX, architecture, and code base before you deploy",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${displayFace.variable} ${bodyFace.variable} ${monoFace.variable}`}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
