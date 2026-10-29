export interface ExtraRepo {
  owner: string;
  repo: string;
  firmware: string;
  description: { en: string; es: string; pt: string };
}

// Checked 2026-10-29 via the GitHub API: each repo exists and its README targets FW 14.10.
// Left out on purpose: single-file "jailbreak" pages, untested one-click PC hosts, empty skeletons.
export const EXTRA_REPOS: ExtraRepo[] = [
  {
    owner: "ftrevino739-ctrl",
    repo: "PS5-14.10-JB",
    firmware: "14.10",
    description: {
      en: "WebKit research with probes run on a real 14.10 console",
      es: "Investigación de WebKit con pruebas en una consola 14.10 real",
      pt: "Pesquisa de WebKit com testes num console 14.10 real",
    },
  },
  {
    owner: "stark3y93",
    repo: "PS5-FW-14.10-Research",
    firmware: "14.10",
    description: {
      en: "Update-package tools plus reports on public 14.10 claims",
      es: "Herramientas de paquetes de actualización e informes sobre lo publicado del 14.10",
      pt: "Ferramentas de pacote de atualização e relatórios sobre o que já saiu do 14.10",
    },
  },
  {
    owner: "Kickazzman",
    repo: "ps5-1410-research",
    firmware: "14.10",
    description: {
      en: "Stage 1 notes and an audit of the numbers circulating publicly",
      es: "Notas de la etapa 1 y una auditoría de los números que circulan",
      pt: "Notas do estágio 1 e auditoria dos números que circulam por aí",
    },
  },
  {
    owner: "oniz93",
    repo: "ps5-14.10-research",
    firmware: "14.10",
    description: {
      en: "Boot-chain reverse engineering (early, software-only)",
      es: "Ingeniería inversa de la cadena de arranque (inicial, solo software)",
      pt: "Engenharia reversa da cadeia de boot (inicial, só software)",
    },
  },
];
