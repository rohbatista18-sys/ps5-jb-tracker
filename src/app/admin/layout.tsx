import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "../globals.css";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-pixel", display: "swap" });
const body = VT323({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Admin · PS5 14.10 Jailbreak Tracker",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b0b14", colorScheme: "dark" };

// Separate root layout: no ads, no pixel crowd, no locale routing. The admin UI is in Portuguese.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${pixel.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
