import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Press_Start_2P, VT323 } from "next/font/google";
import PixelCrowd from "@/components/PixelCrowd";
import { INTL_TAG, LOCALES, OG_LOCALE, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import "../globals.css";

const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-pixel",
  display: "swap",
});

const body = VT323({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { title, description } = getDictionary(lang).meta;
  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    applicationName: title,
    alternates: {
      canonical: `/${lang}`,
      languages: { ...Object.fromEntries(LOCALES.map((l) => [INTL_TAG[l], `/${l}`])), "x-default": "/" },
    },
    openGraph: {
      type: "website",
      locale: OG_LOCALE[lang],
      alternateLocale: LOCALES.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
      url: `/${lang}`,
      siteName: title,
      title,
      description,
    },
    twitter: { card: "summary", title, description },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0b14",
  colorScheme: "dark",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { presence } = getDictionary(lang);

  return (
    <html lang={INTL_TAG[lang]} className={`${pixel.variable} ${body.variable}`}>
      <body>
        <PixelCrowd onlineLabel={presence.online} youLabel={presence.you} visitsLabel={presence.visits} visitsShortLabel={presence.visitsShort} />
        {children}
      </body>
    </html>
  );
}
