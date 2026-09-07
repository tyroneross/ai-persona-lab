import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@components/AppShell";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "AI User Personas",
  description: "Workspace for researched and AI-assisted user personas.",
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
