# STATE

## Decisions

### AD-001
- **Decision**: O Emaús será um MVP web responsivo com operação online, sem PWA, aplicativo nativo ou modo offline.
- **Reason**: Priorizar uso em computador e celular com menor complexidade inicial.
- **Trade-off**: Não atende operação sem internet nem distribuição por lojas de aplicativos.
- **Scope**: Aplicação inteira.
- **Date**: 2026-07-20
- **Status**: active

### AD-002
- **Decision**: A base técnica será TypeScript, Next.js, PostgreSQL, Prisma ORM, Tailwind CSS e componentes próprios.
- **Reason**: Uma base tipada única para interface, rotas de servidor e domínio relacional.
- **Trade-off**: Exige configuração inicial de Node, PostgreSQL local e migrations.
- **Scope**: Arquitetura e implementação do MVP.
- **Date**: 2026-07-20
- **Status**: active

### AD-003
- **Decision**: Autenticação será própria, com nome de usuário e senha, Argon2 e sessão em cookie seguro.
- **Reason**: O domínio requer contas vinculadas a Pessoas, papéis internos e escopos por ministério.
- **Trade-off**: Recuperação de senha e segurança de sessão serão responsabilidade do projeto.
- **Scope**: Contas, autorização e auditoria.
- **Date**: 2026-07-20
- **Status**: active

### AD-004
- **Decision**: A presença será persistida por Pessoa e Encontro, iniciando como não confirmada e alternando por toque entre não confirmado, presente e ausente.
- **Reason**: Lançamento rápido durante encontros, com histórico e auditoria de correções.
- **Trade-off**: A lista elegível é recalculada pelos vínculos atuais ao abrir a frequência, conforme decisão de produto.
- **Scope**: Encontros, frequência, timeline e auditoria.
- **Date**: 2026-07-20
- **Status**: active

### AD-005
- **Decision**: Foto de perfil permanece no modelo, mas upload e armazenamento de imagem ficam fora do primeiro corte técnico.
- **Reason**: Permite iniciar o MVP com menor escopo operacional.
- **Trade-off**: A interface usará iniciais até uma evolução posterior.
- **Scope**: Pessoas e interface.
- **Date**: 2026-07-20
- **Status**: active

### AD-006
- **Decision**: Séries de encontros suportarão recorrência semanal, quinzenal e mensal, com dias da semana selecionáveis e término opcional.
- **Reason**: Cobre programações recorrentes usuais sem implementar uma linguagem de recorrência completamente livre.
- **Trade-off**: Padrões especiais ficam para evolução posterior.
- **Scope**: Séries e ocorrências de encontros.
- **Date**: 2026-07-20
- **Status**: active

### AD-007
- **Decision**: Motivo textual em correção de presença será opcional.
- **Reason**: A auditoria obrigatória já preserva antes/depois, autor e horário, sem travar operação durante o encontro.
- **Trade-off**: Algumas correções podem não ter justificativa humana adicional.
- **Scope**: Presenças, auditoria e timeline.
- **Date**: 2026-07-20
- **Status**: active

### AD-008
- **Decision**: A reconciliação do MVP preserva os IDs e checksums dos quatro migrations já publicados em `dev` e aplica as diferenças do RASP por um migration incremental compatível.
- **Reason**: Bancos que já executaram `20260721*` não podem reaplicar DDL sob novos IDs `20260808*`; o deploy precisa ser seguro tanto em banco novo quanto em upgrade com dados existentes.
- **Trade-off**: Nomes legados de tabelas, colunas, índices e enums permanecem no PostgreSQL e são expostos pelo Prisma com `@map`/`@@map`; registros sentinela de audiência de toda a igreja são normalizados para a representação atual.
- **Scope**: Schema Prisma, migrations e deploy do banco do MVP.
- **Date**: 2026-08-20
- **Status**: active

### AD-009
- **Decision**: A linha de dependências validada no RASP permanece neste lote; a modernização da linha de `dev` (incluindo Next 16 e versões superiores) fica para uma tarefa separada.
- **Reason**: Misturar a atualização de runtime com a reconciliação de migrations amplia o risco sem ser requisito do MVP; o baseline RASP foi o que passou nos gates de aplicação e browser.
- **Trade-off**: A atualização de framework e ferramentas é adiada e deverá ter sua própria validação de compatibilidade.
- **Scope**: `package.json`, `package-lock.json` e runtime do Emaús.
- **Date**: 2026-08-20
- **Status**: active

## Handoff

- **Feature**: `.specs/features/emaus-mvp`
- **Phase / Task**: Release hardening — dev validated, awaiting `dev` → `main` promotion
- **Completed**: instalação do `tlc-spec-driven`; Specify e Design aprovados; MVP T01–T47 implementado; validação registrada em `validation.md`; branch `lote/L001-emaus-mvp-reconcile` criada a partir de `origin/dev`; correção de compatibilidade de migrations em `769de85`; normalização de datas legadas em `9cba03f`; schema, banco novo, upgrade legado, typecheck, lint, build, 31/108 testes Vitest e 28/28 E2E revalidados sem force-push.
- **In-progress**: PR #1 mergeado em `dev` (`3ec4fb6`); gates pós-merge de schema, geração, typecheck, lint e build aprovados; PR #2 aberto para promoção de `dev` para `main`.
- **Next step**: revisão manual e merge do PR #2 quando aprovado; não promover `main` automaticamente.
- **Blockers**: o migration incremental falha deliberadamente quando encontra acessos ministeriais duplicados, exigindo reconciliação explícita antes do deploy daquele banco. Fora essa proteção, `origin/main` permanece em `a84a1c3` até a revisão do PR #2, enquanto `origin/dev` contém a reconciliação validada.
- **Uncommitted files**: nenhum; este snapshot precisa ser atualizado junto com a próxima documentação de estado, se houver mudança pós-merge.
- **Branch**: dev (PR #2 para main)
