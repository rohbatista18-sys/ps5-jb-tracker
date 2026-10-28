# PS5 14.10 Jailbreak Tracker

Agregador não oficial do progresso das 3 pesquisas públicas de jailbreak do PS5 14.10
(Zig, Pasta e Kuzi), com resumos por IA em EN/ES/PT, último commit, links de doação e um fundo 8-bit
onde cada personagem é um visitante online.

Especificação (Speckit): [`specs/001-jailbreak-tracker/`](specs/001-jailbreak-tracker/) · Constituição: [`.specify/memory/constitution.md`](.specify/memory/constitution.md) · Segurança: [`SECURITY.md`](SECURITY.md)

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev
```

## Deploy no Vercel

1. Suba este diretório para um repositório no GitHub e importe-o em <https://vercel.com/new>.
2. Em **Settings → Environment Variables**, cadastre:
   | Variável | Obrigatória | Observação |
   |---|---|---|
   | `AZURE_OPENAI_ENDPOINT` | sim | URL completa `.../openai/v1/responses` |
   | `AZURE_OPENAI_DEPLOYMENT` | sim | nome do deployment |
   | `AZURE_OPENAI_KEY` | sim | marque como *Sensitive* |
   | `GITHUB_TOKEN` | recomendada | token *fine-grained* só com leitura de repositórios públicos (sem ele: 60 req/h) |
   | `CRON_SECRET` | sim | string aleatória longa; o Vercel Cron a envia automaticamente |
3. Em **Storage → Marketplace**, adicione o **Upstash Redis** (plano gratuito) e conecte ao projeto.
   Ele injeta as variáveis `KV_REST_API_URL`/`KV_REST_API_TOKEN`, que já são reconhecidas.
   Sem Redis, o contador de visitantes fica por instância (impreciso) e os resumos são refeitos a cada deploy.
4. Faça o deploy. O cron diário (`vercel.json`) pré-aquece o cache; fora isso, os dados se atualizam sozinhos a cada ~10 min.

## Idiomas

`/` redireciona para `/en`, `/es` ou `/pt`, nesta ordem de prioridade: cookie `lang` (escolha manual no seletor),
país do IP (`x-vercel-ip-country`), `Accept-Language` e, por último, inglês.
