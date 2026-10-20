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
      <body>
        {/* The full-height column that every page sits in: its header, if it has one, then its main
            part. It is here, once, so a page added later is framed like the others. */}
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
