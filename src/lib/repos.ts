import type { RepoConfig } from "./types";

// Donation links taken from each repo's GitHub homepage field / README (checked 2026-10-28).
// X handles provided by the site owner.
export const REPOS: RepoConfig[] = [
  {
    id: "zig",
    nickname: "ZigZagBoi1",
    owner: "ZigZagBoi1",
    repo: "PS5-14.10-Research",
    x: "TrippyBiggy",
    donations: [
      { label: "Ko-fi", url: "https://ko-fi.com/ziggymar" },
      { label: "PayPal", url: "https://www.paypal.me/SalwanStudios" },
    ],
  },
  {
    id: "pasta",
    nickname: "pastawithpesto",
    owner: "pastawithpesto",
    repo: "PS5-14.10-Jailbreak-Research",
    x: "n3onStride7",
    donations: [
      { label: "PayPal", url: "https://paypal.me/arnoldzap" },
      { label: "BTC", value: "bc1qw2lpq8p0cspdk9dlddv6y0wswh6z6svtjjkn73" },
    ],
  },
  {
    id: "kuzi",
    nickname: "kuzibelit",
    owner: "kuzibelit",
    repo: "PS5-14.00-14.10-Jailbreak-PoC",
    x: "kuzibelit",
    donations: [],
    donationNote: "Sem link de doação publicado",
  },
];
