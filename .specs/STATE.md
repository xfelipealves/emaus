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

### AD-010
- **Decision**: Atividades futuras do Emaús serão registradas como backlog compartilhado, visível e editável por todos os usuários ativos/autorizados, com as áreas `Amanhã`, `Backlog` e `Estacionado`, exclusão da atividade e CRUD de subtarefas.
- **Reason**: Dar ao time um lugar comum para organizar pendências e consultar rapidamente o que deve ser tratado amanhã, sem limitar a atividade ao usuário que a criou.
- **Trade-off**: O primeiro corte não associa atividades a Pessoa, Ministério ou Encontro e usa `Amanhã` como bucket de fluxo; essas evoluções ficam para depois.
- **Scope**: Backlog pós-MVP — atividades e subtarefas.
- **Date**: 2026-08-20
- **Status**: active

## Handoff

- **Feature**: `.specs/features/emaus-activities`
- **Phase / Task**: Verified — branch ready for PR `feat/emaus-shared-activities` → `dev`
- **Completed**: especificação, design e tarefas da feature; migration aditiva; serviço com autorização de conta ativa, CRUD de atividades/subtasks e auditoria; página protegida, filtros e interface; cobertura de integração/E2E; validação independente registrada em `.specs/features/emaus-activities/validation.md`.
- **In-progress**: PR #2 continua aberto para promoção de `dev` para `main`; a branch desta feature ainda precisa ser publicada e revisada contra `dev`.
- **Next step**: push da branch, abertura do PR para `dev` e revisão manual; depois de mergear em `dev`, reavaliar o PR #2. Não promover `main` automaticamente.
- **Blockers**: nenhum blocker técnico conhecido para esta feature. O migration incremental legado continua exigindo reconciliação explícita quando encontra acessos ministeriais duplicados.
- **Uncommitted files**: nenhum dentro do repositório; a nota diária do Obsidian foi atualizada fora do Git.
- **Branch**: `feat/emaus-shared-activities` (PR para `dev`)
- **Backlog registrado**: atividade compartilhada com áreas `Amanhã`, `Backlog` e `Estacionado`, exclusão e CRUD de subtarefas; requisito refletido também na nota diária do Obsidian.
