import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@components/AppShell";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Persona Lab",
  description: "Prepare focused reviews and maintain an evidence-labelled persona library.",
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
