# Emaús

> Sistema de acompanhamento de pessoas e organização da vida comunitária de igrejas.

O Emaús será desenvolvido com **Spec-Driven Development**. Antes de implementar interface ou tecnologia, as decisões de negócio são registradas e aprovadas como especificações.

## Estado atual

Specify e Design estão aprovados. O projeto está na fase **Execute**, com a fundação local e o runtime PostgreSQL preparados pelo OpenCode.

## Banco local

Copie `.env.example` para `.env` e substitua os placeholders por valores locais. O arquivo `.env` é ignorado pelo Git.

```bash
docker compose up -d
```

O banco fica disponível em `localhost:5432`. A aplicação e o Prisma devem obter a conexão exclusivamente pela variável `DATABASE_URL`.

## Cenário demo local

Para começar de um banco limpo, aplique as migrations e execute o seed:

```bash
npx prisma migrate reset --force
npm run db:seed
```

O `npm run db:seed` também pode ser executado novamente sobre o banco local: os registros do cenário demo usam IDs estáveis e não são duplicados. Todas as identidades são fictícias e usam domínios locais de teste.

Contas demo (senha comum `emaus-demo`):

- `demo-admin` — administrador
- `demo-secretary` — secretaria
- `demo-leader` — líder com escopo no Ministério Demo Acolhimento

## Documentação de produto

- [Visão do produto](docs/product/01-visao-do-produto.md)
- [Domínio e glossário](docs/product/02-dominio-e-glossario.md)
- [Regras de negócio iniciais](docs/product/03-regras-de-negocio.md)
- [Escopo do MVP](docs/product/04-escopo-do-mvp.md)
- [Requisitos funcionais — Pessoas, Ministérios e Frequência](docs/product/05-requisitos-funcionais-pessoas-ministerios-frequencia.md)
- [Requisitos funcionais — Acessos e Permissões](docs/product/06-requisitos-funcionais-acessos-permissoes.md)
- [Requisitos funcionais — Timeline e Notas](docs/product/07-requisitos-funcionais-timeline-notas.md)
- [Requisitos não funcionais](docs/product/08-requisitos-nao-funcionais.md)
- [Arquitetura da informação e navegação](docs/design/01-arquitetura-da-informacao-e-navegacao.md)
- [Fluxos essenciais](docs/design/02-fluxos-essenciais.md)
- [Modelo de dados inicial](docs/architecture/01-modelo-de-dados-inicial.md)
- [Arquitetura técnica inicial](docs/architecture/02-arquitetura-tecnica-inicial.md)
- [Estado operacional TLC](.specs/STATE.md)
- [Especificação consolidada do MVP](.specs/features/emaus-mvp/spec.md)
- [Design técnico e milestones](.specs/features/emaus-mvp/design.md)
- [Plano de execução T01–T36](.specs/features/emaus-mvp/tasks.md)
- [Operação do Ralph Loop com OpenCode](docs/operations/opencode-ralph-loop.md)
- [QA e prontidão do lote Ralph](docs/operations/opencode-ralph-loop.md#qa-independente-do-lote)
- [Fluxo de branches e PRs do Ralph](docs/operations/ralph-branch-pr-flow.md)

## Fluxo de desenvolvimento

1. **Specify** — negócio, domínio, regras, requisitos e critérios de aceite.
2. **Design** — UX, arquitetura, dados e integrações.
3. **Tasks** — tarefas pequenas, testáveis e ordenadas.
4. **Execute** — implementação, testes e validação com a igreja.

## Princípio do MVP

O primeiro objetivo é permitir que a igreja cadastre e acompanhe pessoas, organize ministérios e registre frequência com histórico confiável. Recursos como WhatsApp, financeiro, QR Code e aplicativo nativo não fazem parte deste primeiro ciclo.
