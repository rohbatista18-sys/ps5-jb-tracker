# Constituição — PS5 14.10 Jailbreak Tracker

## I. Segredos nunca chegam ao cliente
Chaves (Azure OpenAI, GitHub, Upstash) existem apenas em variáveis de ambiente do servidor.
Nenhuma variável sensível usa o prefixo `NEXT_PUBLIC_`. `.env*` está sempre no `.gitignore`.

## II. Conteúdo dos repositórios é dado não confiável
README, commits e issues dos repositórios monitorados são entrada não confiável.
O prompt do resumidor isola esse conteúdo em delimitadores e instrui o modelo a ignorar
instruções contidas nele. A saída do modelo é renderizada sempre como texto puro (nunca HTML).

## III. Custo controlado
O resumo por IA só é refeito quando o SHA do último commit muda. Os resultados ficam
em cache (Data Cache do Next/Vercel + Redis quando disponível). Nenhuma requisição do visitante
dispara chamada à IA diretamente.

## IV. Degradação graciosa
Se a IA, o GitHub ou o Redis falharem, a página continua funcionando: mostra os dados
disponíveis, o último resumo em cache ou uma mensagem neutra. Nada de tela branca.

## V. Fidelidade dos fatos
O resumo descreve o progresso declarado pelos autores, sem exagerar. Se o repositório diz
"não demonstrado", o resumo não pode dizer "concluído".

## VI. Leve e acessível
Primeira carga < 150 KB de JS. Animações 8-bit respeitam `prefers-reduced-motion`.
Contraste AA. Funciona em 360 px de largura.

## VII. Simplicidade
Next.js App Router + TypeScript, sem banco de dados próprio. Dependências só quando pagam o próprio peso.
