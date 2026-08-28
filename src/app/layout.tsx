import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Office Manager",
  description: "Office management system — leave, car logs, petty cash, meetings and minutes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE">
      <body className="antialiased">{children}</body>
    </html>
  );
}
