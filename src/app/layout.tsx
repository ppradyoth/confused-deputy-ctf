import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confused Deputy CTF",
  description:
    "One vulnerability class, four attack surfaces: tool privilege escalation, poisoned retrieval, judge deception, orchestrator manipulation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-mono antialiased">{children}</body>
    </html>
  );
}
