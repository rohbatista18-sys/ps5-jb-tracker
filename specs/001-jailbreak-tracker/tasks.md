# Tasks — Spec 001

Legenda: `[P]` = pode rodar em paralelo · `[D#]` = dev responsável

## Fase 0 — Fundação (Tech Lead)
- [x] T001 Criar o scaffold Next.js + TypeScript
- [x] T002 Escrever os contratos `src/lib/types.ts` e `src/lib/repos.ts`
- [x] T003 Criar `.env.local` (gitignored) com as variáveis do Azure

## Fase 1 — Implementação paralela
- [x] T010 [P][D1] Layout retrô, header, aviso legal e grid de cards
- [x] T011 [P][D1] `RepoCard`: resumo, última atualização (absoluta + relativa), commits recentes, estrelas, doações
- [x] T012 [P][D1] `OverallSummary` no fim da página
- [x] T020 [P][D2] Sprites 8-bit (pixel art em código, 6+ personagens com variação de cor)
- [x] T021 [P][D2] `PixelCrowd`: canvas de fundo, 1 sprite por visitante, máx. 40, reduced-motion
- [x] T022 [P][D2] `usePresence`: heartbeat de 15 s, `sendBeacon` ao sair, pausa com a aba oculta
- [x] T030 [P][D3] `github.ts`: repo, commits e README com revalidate de 600 s e tratamento de erros/rate limit
- [x] T031 [P][D3] `dashboard.ts`: `getDashboard()` orquestrando GitHub + resumos
- [x] T040 [P][D4] `azure-openai.ts`: cliente da Responses API com timeout e parsing robusto
- [x] T041 [P][D4] `summarize.ts`: prompts anti-injection, cache por SHA, resumo consolidado
- [x] T050 [P][D5] `redis.ts` + `presence.ts` (ZSET + fallback em memória)
- [x] T051 [P][D5] `/api/presence` com validação e rate limit
- [x] T052 [P][D5] `/api/cron/refresh` + `vercel.json` cron
- [x] T053 [P][D5] Headers de segurança/CSP em `next.config.ts`, `.env.example`, `SECURITY.md`

## Fase 2 — Integração (Tech Lead)
- [x] T060 `npm run build` + lint sem erros
- [x] T061 Teste local: página, presença com 2 abas, resumos reais
- [x] T062 Grep de segredos no bundle do cliente
- [x] T063 README de deploy no Vercel

## Fase 1b — Emenda A: i18n
- [x] T070 [D4] Resumos trilíngues numa única chamada (contrato `Localized`)
- [x] T071 [TL] `src/i18n/*`: dicionários en/es/pt + `getDictionary`
- [x] T072 [TL] Mover as rotas para `src/app/[lang]/`, com `generateStaticParams`, `<html lang>` e alternates
- [x] T073 [TL] `src/proxy.ts`: detecção cookie → país → Accept-Language → en
- [x] T074 [TL] `LanguageSwitcher` (client) gravando o cookie
- [x] T075 [TL] Localizar RepoCard, OverallSummary, RelativeTime e o HUD do PixelCrowd
