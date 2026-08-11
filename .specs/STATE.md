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

## Handoff

- **Feature**: `.specs/features/emaus-mvp`
- **Phase / Task**: Execute — M8/T36
- **Completed**: instalação do `tlc-spec-driven`; Specify aprovado; Design aprovado; milestones M1–M8 e tasks T01–T36 criados; bootstrap T01, runtime PostgreSQL T02, workflow Prisma T03, shell responsivo T04, primitives de interface T05, schema de Pessoa/Conta T06, schema de Ministérios/vínculos/escopos T07, schema de encontros/séries/públicos/frequência T08, schema de notas/versões/timeline/auditoria T09, seed/utilitários de data/fuso T10, hash Argon2/validação de credenciais T11, persistência/ciclo de sessão T12, login/redirecionamento protegido T13, autorização por papel e Ministério T14, administração de contas T15, serviço transacional de Pessoas T16, cadastro de visitantes/membros T17, transições de status T18, lista/busca/filtros de Pessoas T19, perfil geral de Pessoa T20, administração de Ministérios T21, histórico de vínculos ministeriais T22, grants/revogação de escopos ministeriais T23, perfil/histórico de Ministérios T24, categorias/séries/recorrência T25, criação de encontros/públicos T26, inicialização idempotente de frequência T27, ciclo/auditoria de presença T28, busca/visitante rápido/resumos de frequência T29, timeline/filtros do perfil T30, criação/edição versionada de notas T31, arquivamento/filtro de notas T32, consulta/tela administrativa de auditoria T33, cenário demo local idempotente T34, suíte Playwright crítica isolada T35, correção de lint/build gate T37, ciclo de status de Pessoa T38, histórico de frequência T39, estabilização de cold start T40, normalização de datas São Paulo T41 e retry de presença T42 validados
- **In-progress** (file:line): T36 — verificação independente evidence-or-zero, sensor, UAT e validation.md; qualquer gap residual deve virar task atômica antes do PASS
- **Next step**: executar o Build gate, consolidar a matriz independente de requisitos, confirmar sensor/UAT, corrigir gaps atômicos se houver e só então commitar validation.md/STATE final.
- **Blockers**: nenhum. T42 passou no Full com 31 arquivos/102 testes de integração e 26 E2E, com adequacy review PASS. A validação independente T36 segue inline pelo Codex; OpenCode e Ralph Loop não foram usados.
- **Uncommitted files**: nenhum após o commit de T42 e esta sincronização do loop-state
- **Branch**: main
