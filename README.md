# Emaús

> Acompanhamento de pessoas e da vida comunitária da igreja.
> “Fica conosco, porque é tarde, e já declinou o dia.” — Lucas 24:29

O Emaús reúne em um só lugar quem caminha com a igreja: cadastro de pessoas e famílias,
ministérios, encontros com presença e o cuidado pastoral de quem se afastou.

## Para quem é

O Emaús é uma ferramenta **da liderança**, não um app para toda a igreja. Só pastores,
secretaria e líderes têm conta, criadas por um administrador. A congregação só interage pelo
check-in por QR Code (e, se a igreja permitir, pelo autocadastro de visitantes).

- Contas nascem com **senha provisória**: a troca é obrigatória no primeiro acesso.
- **Líderes** veem apenas as pessoas dos ministérios liberados para eles.
- **Anotações confidenciais** ficam visíveis só para administradores (pastores).
- Administradores veem o último acesso de cada conta e podem encerrar sessões.
- Login com limite de tentativas; o app fica fora de buscadores (`noindex`).

## O que tem

- **Painel pastoral** — pessoas ativas, média semanal de presença com tendência, gráfico de
  12 semanas, quem está sumido, visitantes recentes (e se voltaram) e aniversariantes.
- **Pessoas** — lista com busca instantânea (sem acento, por nome ou telefone), filtros por
  status e ministério, perfil com linha do tempo, anotações fixáveis, grade de frequência de
  20 semanas, ministérios e família. WhatsApp em um toque.
- **Famílias** — agrupe a casa toda; papéis (responsável, cônjuge, filhos).
- **Ministérios** — participantes, líderes, histórico de vínculos e engajamento semanal.
- **Encontros** — lista e calendário, séries recorrentes (semanal, quinzenal, mensal) geradas
  automaticamente, público por ministério.
- **Presença** — lista otimizada para celular (toque em ✓ / ✕), visitante rápido sem sair
  da tela, “marcar pendentes como ausentes”, correções auditadas.
- **Modo recepção** — tela cheia para tablet na entrada: a pessoa digita o nome e confirma.
- **Check-in por QR Code** — projete o QR; a pessoa confirma pelo celular (pelo telefone
  cadastrado) e visitantes se cadastram sozinhos. Só aceita registros com o check-in aberto.
- **Cuidado pastoral** — acompanhamentos (ligar, visitar, orar…) com responsável e prazo;
  lista de quem passou do limite de dias sem presença.
- **Importar / exportar CSV** — reconhece colunas comuns em português, datas DD/MM/AAAA,
  cria famílias e ignora duplicados. Exportação abre direto no Excel.
- **Permissões** — Administrador, Secretaria e Líder (vê só os ministérios liberados).
- **Auditoria** — correções de presença, mudanças de status, contas e exclusões.
- **PWA** — instalável no celular, tema claro/escuro, busca global com ⌘K.

## Assistente (IA)

Em **Assistente** (ou ⌘K → "Perguntar…"), a liderança conversa em português com o Emaús:
"quem do New Mind faltou nos dois últimos sábados?", "marca presença do Davi no último culto",
"cria um acompanhamento para eu ligar para os visitantes que vieram só uma vez".

- **Agente com ferramentas** (Claude Opus 5.5 via API da Anthropic): 12 consultas e 12 operações
  sobre o banco (`src/server/ai/tools.ts`). Em vez de embeddings, a recuperação é feita por
  ferramentas que consultam os dados estruturados — sempre frescos e exatos.
- Tudo roda **com o acesso de quem pergunta**: líderes só alcançam seus ministérios, notas
  confidenciais só chegam a pastores, e cada alteração entra na auditoria como "via assistente".
  Exclusão de cadastro exige confirmação explícita na conversa.
- **LLMOps** em Configurações → IA: perguntas, custo estimado, latência (p50/p95), taxa de erro,
  uso de cache, ferramentas mais usadas, uso por pessoa e avaliações 👍/👎 de cada resposta.
- Configure `ANTHROPIC_API_KEY` no `.env` do servidor (veja `.env.example`).

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 ·
shadcn/ui (Base UI) · Drizzle ORM + SQLite (libSQL) · Better Auth · Recharts · Vitest.

Sem Docker e sem servidor de banco: os dados ficam em `data/emaus.db` (SQLite em modo WAL).
Para fazer backup, copie esse arquivo (de preferência com o serviço parado ou via
`sqlite3 data/emaus.db ".backup backup.db"`).

## Rodando localmente

```bash
cp .env.example .env          # e gere um BETTER_AUTH_SECRET: openssl rand -base64 32
npm install
npm run db:migrate
npm run db:seed               # opcional: APAGA o banco e carrega a igreja demo
npm run dev
```

### Pessoas reais dos ministérios (WhatsApp)

```bash
node scripts/extract-whatsapp-roster.mjs   # lê WhatsApp Desktop + nchat deste Mac
npm run db:seed                            # usa data/roster.json se existir
```

O script grava em `data/roster.json` (fora do git) só nome, ministérios e função de quem está
nos grupos dos ministérios e tem o contato salvo na agenda — sem telefones nem mensagens.
Admins dos grupos, a Supervisão e a Liderança New Mind viram líderes. O restante da
congregação continua fictício, e anotações, acompanhamentos e afastamentos nunca são
gerados para pessoas reais. A frequência é simulada.

Contas do cenário demo: `admin`, `secretaria` e `lider` — senha `emaus2026`
(ou o valor de `SEED_PASSWORD`).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e servidor de produção |
| `npm run db:generate` | gera migration a partir de `src/db/schema.ts` |
| `npm run db:migrate` | aplica migrations pendentes |
| `npm run db:seed` | recria o cenário demo (destrutivo) |
| `npm run db:studio` | Drizzle Studio para inspecionar o banco |
| `npm test` | testes unitários (datas, recorrência, CSV) |
| `npm run lint` / `npm run typecheck` | qualidade |

## Estrutura

```
src/
  app/(auth)/login        login
  app/(app)/…             telas autenticadas (painel, pessoas, famílias, ministérios,
                          encontros, cuidado, configurações) + server actions
  app/checkin/[id]        modo recepção (tela cheia)
  app/c/[token]           check-in público por QR
  components/             design system (ui/ = shadcn) e componentes de domínio
  db/                     schema Drizzle, cliente, migrate e seed
  server/                 regras de negócio e consultas (sempre no servidor)
  lib/                    utilitários puros: datas com fuso, recorrência, CSV, textos
drizzle/                  migrations SQL
deploy/                   unidade systemd e script de deploy no Raspberry
```

## Deploy no Raspberry

```bash
deploy/deploy-rasp.sh          # rsync + npm ci + migrate + build + restart
deploy/deploy-rasp.sh --seed   # idem, recriando o banco demo (APAGA os dados)
```

Na primeira vez, instale `deploy/emaus.service` em `/etc/systemd/system/` e rode
`sudo systemctl daemon-reload && sudo systemctl enable --now emaus`. O app escuta em
`127.0.0.1:3100`; a exposição na tailnet continua via `tailscale serve --https=8444`.

## Documentação de produto

As regras de negócio originais continuam em [`docs/product`](docs/product).
