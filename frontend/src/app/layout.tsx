import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Copilot",
  description: "Agentic ERP insights with ML predictions"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
