import type { Metadata } from "next";
import { DEFAULT_THEME } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Focusqueue",
  description: "A queue for one week.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME}>
      <body>{children}</body>
    </html>
  );
}
