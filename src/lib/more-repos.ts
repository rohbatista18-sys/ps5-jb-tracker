export interface ExtraRepo {
  owner: string;
  repo: string;
  firmware: string;
  description: { en: string; es: string; pt: string };
}

export const EXTRA_REPOS: ExtraRepo[] = [
  {
    owner: "ntfargo",
    repo: "Relapse-Exploit",
    firmware: "7.00–13.60",
    description: {
      en: "WebKit + kernel exploit chain (Relapse)",
      es: "Cadena de exploit WebKit + kernel (Relapse)",
      pt: "Cadeia de exploit WebKit + kernel (Relapse)",
    },
  },
  {
    owner: "Cryptogenic",
    repo: "PS5-IPV6-Kernel-Exploit",
    firmware: "≤ 4.51",
    description: {
      en: "IPv6 UAF kernel exploit (foundational research)",
      es: "Exploit de kernel IPv6 UAF (investigación base)",
      pt: "Exploit de kernel IPv6 UAF (pesquisa base)",
    },
  },
  {
    owner: "DuskFal1",
    repo: "p2jb",
    firmware: "11.00–12.00",
    description: {
      en: "JavaScript kernel exploit (P2JB bug by Gezine)",
      es: "Exploit de kernel en JavaScript (bug P2JB de Gezine)",
      pt: "Exploit de kernel em JavaScript (bug P2JB do Gezine)",
    },
  },
  {
    owner: "PlGGS",
    repo: "umtx2",
    firmware: "1.00–5.50",
    description: {
      en: "UMTX jailbreak (WebKit-based)",
      es: "Jailbreak UMTX (basado en WebKit)",
      pt: "Jailbreak UMTX (baseado em WebKit)",
    },
  },
  {
    owner: "Starter1552",
    repo: "PS5-Relapse",
    firmware: "7.00–13.60",
    description: {
      en: "Relapse exploit host (self-host alternative)",
      es: "Host del exploit Relapse (alternativa auto-alojada)",
      pt: "Host do exploit Relapse (alternativa auto-hospedada)",
    },
  },
];
