import { LOCALES, type Locale } from "@/lib/types";

export { LOCALES, type Locale };

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const hasLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

export const INTL_TAG: Record<Locale, string> = { en: "en-US", es: "es", pt: "pt-BR" };
export const OG_LOCALE: Record<Locale, string> = { en: "en_US", es: "es_ES", pt: "pt_BR" };
export const LOCALE_NAME: Record<Locale, string> = { en: "English", es: "Español", pt: "Português" };

// ISO 3166-1 alpha-2 codes as sent by Vercel in `x-vercel-ip-country`.
const PT_COUNTRIES = new Set(["BR", "PT", "AO", "MZ", "CV", "GW", "ST", "TL"]);
const ES_COUNTRIES = new Set([
  "ES", "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CU", "BO", "DO",
  "HN", "PY", "SV", "NI", "CR", "PA", "UY", "PR", "GQ",
]);

export function localeFromCountry(country: string | null): Locale | null {
  if (!country) return null;
  const c = country.toUpperCase();
  if (PT_COUNTRIES.has(c)) return "pt";
  if (ES_COUNTRIES.has(c)) return "es";
  return null;
}

export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((l) => l.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.find((l) => hasLocale(l.base))?.base as Locale | undefined ?? null;
}
