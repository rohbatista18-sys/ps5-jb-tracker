# Plano técnico — Spec 001

## Stack
- Next.js (App Router) + TypeScript, deploy no Vercel.
- CSS Modules + fonte "Press Start 2P" (Google Fonts via `next/font`).
- GitHub REST API (fetch nativo, `GITHUB_TOKEN` opcional para 5000 req/h).
- Azure OpenAI Responses API (`POST {AZURE_OPENAI_ENDPOINT}`, header `api-key`, `model = AZURE_OPENAI_DEPLOYMENT`).
- Upstash Redis via REST (`@upstash/redis`) para presença, rate limit e cache de resumos; fallback em memória.

## Arquitetura
```
Browser ──GET /──────────────▶ page.tsx (Server Component, revalidate=600)
                                 └─ getDashboard() ─┬─ github.ts  (fetch + next.revalidate)
                                                    └─ summarize.ts (cache por SHA → Azure OpenAI)
Browser ──POST /api/presence (15s)──▶ presence.ts ─▶ Redis ZSET (score = timestamp)
Vercel Cron ─GET /api/cron/refresh─▶ revalidatePath('/') + pré-aquecimento
```

## Estrutura de arquivos e responsáveis
| Área | Dev | Arquivos |
|---|---|---|
| Frontend / UI | Dev 1 | `src/app/page.tsx`, `src/app/page.module.css`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/RepoCard*`, `src/components/OverallSummary*`, `src/components/RelativeTime.tsx`, `src/components/DonateLinks*` |
| Pixel art / tempo real | Dev 2 | `src/components/PixelCrowd.tsx`, `src/components/PixelCrowd.module.css`, `src/components/sprites.ts`, `src/hooks/usePresence.ts` |
| Dados GitHub | Dev 3 | `src/lib/github.ts`, `src/lib/dashboard.ts` |
| IA / resumos | Dev 4 | `src/lib/summarize.ts`, `src/lib/azure-openai.ts` |
| Segurança / infra | Dev 5 | `src/app/api/presence/route.ts`, `src/app/api/cron/refresh/route.ts`, `src/lib/presence.ts`, `src/lib/redis.ts`, `src/lib/rate-limit.ts`, `src/lib/env.ts`, `next.config.ts`, `vercel.json`, `.env.example`, `SECURITY.md` |

O contrato compartilhado fica em `src/lib/types.ts` e `src/lib/repos.ts` (escritos antes de distribuir as tarefas; somente leitura para os devs).

## Contratos
Ver `src/lib/types.ts`. Resumo:
- `getDashboard(): Promise<DashboardData>` (Dev 3), usa `summarizeRepo` e `summarizeOverall` (Dev 4).
- `POST /api/presence { id }` → `{ online: number }` (Dev 5); `DELETE`/beacon remove o visitante.
- `usePresence()` → `{ online: number }` (Dev 2).

## Segurança
- CSP restrita, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- O prompt da IA delimita o conteúdo do repositório, o README é truncado em 12k caracteres e a saída é limitada e tratada como texto.
- Presença: o ID é um UUID v4 validado por regex; rate limit de 10 req/min por IP; o corpo é limitado a 200 bytes.
- O cron é validado por `Authorization: Bearer ${CRON_SECRET}`.
