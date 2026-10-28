# Spec 001 — PS5 14.10 Jailbreak Tracker

**Status:** Draft · **Criado:** 2026-10-28

## Visão
Uma página pública que acompanha, num só lugar, o progresso das três principais pesquisas
públicas de jailbreak do PS5 no firmware 14.10, com resumos curtos gerados por IA, data da última
atualização de cada repositório, links de doação para os pesquisadores e um fundo 8-bit em que
cada personagem representa um visitante online agora.

## Repositórios monitorados
| Apelido | Repositório | Doação |
|---|---|---|
| Zig | https://github.com/ZigZagBoi1/PS5-14.10-Research | Ko-fi https://ko-fi.com/ziggymar · PayPal https://www.paypal.me/SalwanStudios |
| Pasta | https://github.com/pastawithpesto/PS5-14.10-Jailbreak-Research | PayPal https://paypal.me/arnoldzap · BTC `bc1qw2lpq8p0cspdk9dlddv6y0wswh6z6svtjjkn73` |
| Kuzi | https://github.com/kuzibelit/PS5-14.00-14.10-Jailbreak-PoC | Nenhum link de doação publicado; mostrar o perfil no X https://x.com/kuzibelit |

## Histórias de usuário
- **US1 (P1):** Como fã de PS5, abro a página e vejo um card por pesquisador com o resumo curto
  (2 a 4 frases) do progresso atual.
- **US2 (P1):** Em cada card vejo a data e hora do último commit (no fuso do meu navegador)
  e há quanto tempo ele aconteceu ("há 3 h").
- **US3 (P1):** No fim da página leio um resumo consolidado dos três ("onde a cena está hoje").
- **US4 (P2):** Ao lado de cada repositório vejo como doar para o pesquisador.
- **US5 (P2):** No fundo vejo mini personagens 8-bit andando, um por pessoa online,
  e um contador "N online agora".
- **US6 (P3):** Vejo os últimos 3 commits de cada repositório (mensagem + hora).

## Requisitos funcionais
- **FR-001:** O sistema consulta a API do GitHub para cada repositório: último commit (SHA, data, mensagem),
  últimos commits, README, estrelas e `pushed_at`.
- **FR-002:** Os dados do GitHub são revalidados no máximo a cada 10 minutos.
- **FR-003:** O resumo por repositório é gerado pelo Azure OpenAI (deployment gpt-5.1) e fica em cache por SHA.
- **FR-004:** O resumo consolidado fica em cache pela combinação dos 3 SHAs.
- **FR-005:** A presença em tempo real usa heartbeat do cliente (a cada 15 s); um visitante sai da contagem após 35 s sem heartbeat.
- **FR-006:** O número de sprites desenhados é limitado a 40, com o excedente indicado como "+N".
- **FR-007:** O endpoint de presença tem rate limit por IP e valida o ID do visitante.
- **FR-008:** A página exibe um aviso de que é um agregador não oficial e não hospeda exploits.
- **FR-009:** O sistema tem um endpoint de cron (`/api/cron/refresh`) protegido por `CRON_SECRET` que pré-aquece o cache.

## Emenda A — Internacionalização (2026-10-28)
- **US7 (P1):** Como visitante de qualquer país, vejo o site em inglês, espanhol ou português, e posso trocar de idioma num seletor.
- **FR-010:** Rotas por idioma: `/en`, `/es`, `/pt`. A rota `/` redireciona para o idioma detectado.
- **FR-011:** A detecção segue esta ordem: (1) cookie `lang` com a escolha manual; (2) país do IP (`x-vercel-ip-country`: BR/PT/AO/MZ → pt; países hispânicos → es); (3) `Accept-Language`; (4) `en` como padrão.
- **FR-012:** O seletor de idioma grava o cookie `lang` (1 ano) e navega para a rota equivalente.
- **FR-013:** Os resumos de IA são gerados nos 3 idiomas numa única chamada por SHA, sem multiplicar o custo.
- **FR-014:** Todo o texto da interface, as datas e os tempos relativos ficam localizados; `<html lang>` e os `hreflang` alternates são corretos.
- *Esclarecimento:* "detectar de onde é o login" = localização do visitante, já que o site não tem login.

## Fora do escopo
- Hospedar, baixar ou espelhar código de exploit.
- Login ou contas de usuário.
- Notificações push.

## Critérios de sucesso
- A página carrega em menos de 2 s (LCP), com o cache aquecido.
- No máximo 3 + 1 chamadas à IA por mudança de commit; zero chamadas em visitas normais.
- O contador de presença fica correto em até ±1 dentro de 40 s.
- Nenhum segredo aparece no bundle do cliente (verificado com grep no `.next/static`).

## Esclarecimentos (resolvidos por padrão sensato)
- *Idioma dos resumos?* → Português do Brasil.
- *Persistência da presença?* → Upstash Redis (integração do Vercel Marketplace); sem Redis, cai num fallback em memória (aproximado, por instância).
- *Fuso de exibição?* → O do navegador, com o ISO completo no tooltip.
