import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "OutreachFlow",
  description: "Single-owner outreach workflow for a small web-design agency."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
