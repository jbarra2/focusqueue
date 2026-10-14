import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Focusqueue",
  description: "A queue for one school week.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
