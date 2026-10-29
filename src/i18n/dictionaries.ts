import type { Locale } from "./config";

const en = {
  meta: {
    title: "PS5 14.10 Jailbreak Tracker",
    description:
      "Track the public PS5 firmware 14.10 jailbreak research (Zig, Pasta and Kuzi) in one place, with AI summaries, last commit times and donation links.",
  },
  header: {
    subtitle: "Progress of the 3 public firmware 14.10 jailbreak research projects, in one place.",
    lastChecked: "Last checked",
    language: "Language",
  },
  loading: "Loading repository data",
  status: {
    early: "Early",
    progressing: "In progress",
    breakthrough: "Breakthrough!",
    stalled: "Stalled",
    unknown: "?",
  },
  card: {
    newTab: "(opens in a new tab)",
    stars: "stars",
    githubErrorStrong: "Could not reach GitHub.",
    githubErrorRest: "Showing the latest available data.",
    summary: "Summary",
    aiHint: "AI unavailable — provisional summary.",
    lastUpdate: "Last update",
    noCommits: "No commits",
    recentCommits: "Recent commits",
    xProfile: "{name} on X",
  },
  progress: {
    title: "Estimated progress",
    unknown: "Not enough data to estimate progress yet.",
    details: "Chain stages",
    note: "Estimated by AI from what the repository itself reports — not an official percentage.",
    states: { done: "Demonstrated", partial: "Partial", none: "Not yet" },
    stages: {
      entry: "Entry point (userland code execution)",
      userlandRw: "Userland read/write",
      kaslr: "Kernel leak / KASLR bypass",
      kernelRw: "Kernel read/write",
      privesc: "Privilege escalation (jailbreak)",
      release: "Full chain released",
    },
  },
  reactions: {
    title: "Send good vibes",
    total: "{n} sent",
    send: "Send",
    slowDown: "Could not send right now. Try again in a minute.",
    remaining: "{n} of {max} salves left this hour",
    quotaReached: "You have used your {max} salves for this hour. More at {time}!",
    names: { heart: "Love", clap: "Applause", rocket: "Let's go", fire: "On fire", muscle: "Strength", pray: "Thank you", party: "Celebrate", trophy: "Champion", brazil: "Brazilian girls" },
  },
  news: {
    title: "News",
    close: "Close",
    subtitle: "From Google News · last 60 days",
    empty: "No news found right now.",
    disclaimer: "Third-party links, not verified by this site. Never download anything that promises a free jailbreak.",
  },
  moreRepos: {
    title: "More repos",
    close: "Close",
    subtitle: "Other public PS5 jailbreak / exploit repositories",
    disclaimer: "These repositories may cover older firmware. They are listed for reference and research only.",
  },
  overall: { title: "Overall summary", generatedAt: "Generated", loading: "Loading" },
  donate: {
    support: "Support",
    supportName: "Support {name}",
    noDonation: "No donation link published",
    purpose: "Donations support the dev's research. They do NOT buy the jailbreak.",
    address: "{label} address",
    copy: "Copy",
    copyAria: "Copy {label}: {value}",
    copied: "Copied!",
    copiedSr: "Address copied",
    error: "Error",
    errorSr: "Could not copy",
  },
  presence: { online: "online now", you: "YOU", visits: "{n} views so far", visitsShort: "{n} views" },
  footer: {
    disclaimer:
      "Unofficial aggregator. We do not host exploits. AI-generated summaries may contain errors — check the repository.",
    meta: "Data: GitHub API · refreshed every ~10 min",
    source: "This site's source code on GitHub",
    donationWarning:
      "Donations only support the developers' work and are NOT a way to get the jailbreak. No developer will ever ask for donations in exchange for delivering the jailbreak. If someone does, it is a scam.",
    donations:
      "Donations have no affiliation with Forever-Necessary: every donation link goes straight to the developer's own page, and this site receives nothing.",
    nonprofit: "This is a non-profit site.",
    privacy:
      "Privacy: no accounts, no analytics, no tracking. The only cookie stores your language choice. The online counter uses a random, anonymous ID that lives only in this tab and is deleted from our servers within a minute. We don't store IP addresses.",
  },
};

export type Dictionary = typeof en;

const es: Dictionary = {
  meta: {
    title: "PS5 14.10 Jailbreak Tracker",
    description:
      "Sigue en un solo lugar las investigaciones públicas de jailbreak del PS5 en el firmware 14.10 (Zig, Pasta y Kuzi), con resúmenes por IA, último commit y enlaces de donación.",
  },
  header: {
    subtitle: "El progreso de las 3 investigaciones públicas de jailbreak del firmware 14.10, en un solo lugar.",
    lastChecked: "Última verificación",
    language: "Idioma",
  },
  loading: "Cargando datos de los repositorios",
  status: {
    early: "Inicio",
    progressing: "En progreso",
    breakthrough: "¡Avance!",
    stalled: "Detenido",
    unknown: "?",
  },
  card: {
    newTab: "(se abre en una pestaña nueva)",
    stars: "estrellas",
    githubErrorStrong: "No se pudo consultar GitHub.",
    githubErrorRest: "Mostrando los últimos datos disponibles.",
    summary: "Resumen",
    aiHint: "IA no disponible — resumen provisional.",
    lastUpdate: "Última actualización",
    noCommits: "Sin commits",
    recentCommits: "Commits recientes",
    xProfile: "{name} en X",
  },
  progress: {
    title: "Progreso estimado",
    unknown: "Aún no hay datos suficientes para estimar el progreso.",
    details: "Etapas de la cadena",
    note: "Estimado por IA a partir de lo que el propio repositorio informa — no es un porcentaje oficial.",
    states: { done: "Demostrado", partial: "Parcial", none: "Aún no" },
    stages: {
      entry: "Punto de entrada (ejecución en userland)",
      userlandRw: "Lectura/escritura en userland",
      kaslr: "Fuga del kernel / bypass de KASLR",
      kernelRw: "Lectura/escritura en el kernel",
      privesc: "Escalada de privilegios (jailbreak)",
      release: "Cadena completa publicada",
    },
  },
  reactions: {
    title: "Manda buena vibra",
    total: "{n} enviados",
    send: "Enviar",
    slowDown: "No se pudo enviar ahora. Intenta de nuevo en un minuto.",
    remaining: "Te quedan {n} de {max} salves esta hora",
    quotaReached: "Ya usaste tus {max} salves de esta hora. ¡Más a las {time}!",
    names: { heart: "Amor", clap: "Aplausos", rocket: "¡Vamos!", fire: "En llamas", muscle: "Fuerza", pray: "Gracias", party: "Celebrar", trophy: "Campeón", brazil: "Chicas brasileñas" },
  },
  news: {
    title: "Noticias",
    close: "Cerrar",
    subtitle: "De Google Noticias · últimos 60 días",
    empty: "No se encontraron noticias por ahora.",
    disclaimer: "Enlaces de terceros, no verificados por este sitio. Nunca descargues nada que prometa un jailbreak gratis.",
  },
  moreRepos: {
    title: "Más repos",
    close: "Cerrar",
    subtitle: "Otros repositorios públicos de jailbreak / exploit de PS5",
    disclaimer: "Estos repositorios pueden cubrir firmware más antiguo. Se listan solo como referencia e investigación.",
  },
  overall: { title: "Resumen general", generatedAt: "Generado", loading: "Cargando" },
  donate: {
    support: "Apoya",
    supportName: "Apoya a {name}",
    noDonation: "Sin enlace de donación publicado",
    purpose: "Las donaciones apoyan la investigación del dev. NO compran el jailbreak.",
    address: "dirección {label}",
    copy: "Copiar",
    copyAria: "Copiar {label}: {value}",
    copied: "¡Copiado!",
    copiedSr: "Dirección copiada",
    error: "Error",
    errorSr: "No se pudo copiar",
  },
  presence: { online: "en línea ahora", you: "TÚ", visits: "{n} accesos hasta ahora", visitsShort: "{n} accesos" },
  footer: {
    disclaimer:
      "Agregador no oficial. No alojamos exploits. Los resúmenes generados por IA pueden contener errores — revisa el repositorio.",
    meta: "Datos: API de GitHub · actualizado cada ~10 min",
    source: "Código fuente de este sitio en GitHub",
    donationWarning:
      "Las donaciones solo apoyan el trabajo de los desarrolladores y NO son para obtener el jailbreak. Ningún desarrollador pedirá donaciones a cambio de entregar el jailbreak. Si alguien lo hace, es una estafa.",
    donations:
      "Las donaciones no tienen ninguna afiliación con Forever-Necessary: cada enlace de donación lleva directamente a la página del propio desarrollador y este sitio no recibe nada.",
    nonprofit: "Este sitio no tiene fines de lucro.",
    privacy:
      "Privacidad: sin cuentas, sin analíticas, sin rastreo. La única cookie guarda tu idioma. El contador en línea usa un ID aleatorio y anónimo que vive solo en esta pestaña y se borra de nuestros servidores en menos de un minuto. No guardamos direcciones IP.",
  },
};

const pt: Dictionary = {
  meta: {
    title: "PS5 14.10 Jailbreak Tracker",
    description:
      "Acompanhe em um só lugar o progresso das pesquisas públicas de jailbreak do PS5 no firmware 14.10 (Zig, Pasta e Kuzi), com resumos por IA, último commit e links de doação.",
  },
  header: {
    subtitle: "O progresso das 3 pesquisas públicas de jailbreak do firmware 14.10, num só lugar.",
    lastChecked: "Última verificação",
    language: "Idioma",
  },
  loading: "Carregando dados dos repositórios",
  status: {
    early: "Início",
    progressing: "Em progresso",
    breakthrough: "Avanço!",
    stalled: "Parado",
    unknown: "?",
  },
  card: {
    newTab: "(abre em nova aba)",
    stars: "estrelas",
    githubErrorStrong: "Falha ao consultar o GitHub.",
    githubErrorRest: "Mostrando os últimos dados disponíveis.",
    summary: "Resumo",
    aiHint: "IA indisponível — resumo provisório.",
    lastUpdate: "Última atualização",
    noCommits: "Sem commits",
    recentCommits: "Commits recentes",
    xProfile: "{name} no X",
  },
  progress: {
    title: "Progresso estimado",
    unknown: "Ainda não há dados suficientes para estimar o progresso.",
    details: "Etapas da cadeia",
    note: "Estimado por IA a partir do que o próprio repositório relata — não é uma porcentagem oficial.",
    states: { done: "Demonstrado", partial: "Parcial", none: "Ainda não" },
    stages: {
      entry: "Ponto de entrada (execução no userland)",
      userlandRw: "Leitura/escrita no userland",
      kaslr: "Vazamento do kernel / bypass do KASLR",
      kernelRw: "Leitura/escrita no kernel",
      privesc: "Escalada de privilégios (jailbreak)",
      release: "Cadeia completa publicada",
    },
  },
  reactions: {
    title: "Mande um salve",
    total: "{n} enviados",
    send: "Enviar",
    slowDown: "Não deu para enviar agora. Tente de novo em um minuto.",
    remaining: "Restam {n} de {max} salves nesta hora",
    quotaReached: "Você já usou seus {max} salves desta hora. Mais às {time}!",
    names: { heart: "Amor", clap: "Aplausos", rocket: "Bora!", fire: "Pegando fogo", muscle: "Força", pray: "Obrigado", party: "Comemorar", trophy: "Campeão", brazil: "Garotas Brazileiras" },
  },
  news: {
    title: "Notícias",
    close: "Fechar",
    subtitle: "Do Google Notícias · últimos 60 dias",
    empty: "Nenhuma notícia encontrada no momento.",
    disclaimer: "Links de terceiros, não verificados por este site. Nunca baixe nada que prometa jailbreak grátis.",
  },
  moreRepos: {
    title: "Mais repos",
    close: "Fechar",
    subtitle: "Outros repositórios públicos de jailbreak / exploit de PS5",
    disclaimer: "Estes repositórios podem cobrir firmware mais antigo. Listados apenas como referência e pesquisa.",
  },
  overall: { title: "Resumo geral", generatedAt: "Gerado em", loading: "Carregando" },
  donate: {
    support: "Apoie",
    supportName: "Apoie {name}",
    noDonation: "Sem link de doação publicado",
    purpose: "Doações apoiam a pesquisa do dev. NÃO compram o jailbreak.",
    address: "endereço {label}",
    copy: "Copiar",
    copyAria: "Copiar {label}: {value}",
    copied: "Copiado!",
    copiedSr: "Endereço copiado",
    error: "Erro",
    errorSr: "Não foi possível copiar",
  },
  presence: { online: "online agora", you: "VOCÊ", visits: "{n} acessos até agora", visitsShort: "{n} acessos" },
  footer: {
    disclaimer:
      "Agregador não oficial. Não hospedamos exploits. Resumos gerados por IA podem conter erros — confira o repositório.",
    meta: "Dados: API do GitHub · atualizado a cada ~10 min",
    source: "Código-fonte deste site no GitHub",
    donationWarning:
      "As doações servem apenas para apoiar o trabalho dos desenvolvedores e NÃO são para obter o jailbreak. Nenhum desenvolvedor pedirá doações em troca de entregar o jailbreak. Se alguém pedir, é golpe.",
    donations:
      "As doações não têm nenhuma afiliação com o Forever-Necessary: cada link de doação leva direto para a página do próprio desenvolvedor, e este site não recebe nada.",
    nonprofit: "Este site não tem fins lucrativos.",
    privacy:
      "Privacidade: sem contas, sem analytics, sem rastreamento. O único cookie guarda o seu idioma. O contador online usa um ID aleatório e anônimo que existe só nesta aba e é apagado dos nossos servidores em menos de um minuto. Não guardamos endereços IP.",
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, es, pt };

export const getDictionary = (locale: Locale) => dictionaries[locale];

export const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
