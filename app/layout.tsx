import type { Metadata, Viewport } from "next";
import { Newsreader, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Newsreader({ variable: "--font-display", subsets: ["latin"], style: ["normal", "italic"] });
const ui = Instrument_Sans({ variable: "--font-ui", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dead Reckoning",
  description: "A pirate treasure hunt for 2–5 players. Find a key, reach the chest, outwit your rivals.",
};

export const viewport: Viewport = { themeColor: "#0a0f14", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
