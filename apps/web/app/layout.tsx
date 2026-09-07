import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@components/AppShell";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "AI Persona Lab",
  description: "Launch synthetic personas to review your app UI/UX, architecture, and code base before you deploy",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
