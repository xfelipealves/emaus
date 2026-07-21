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
- **Phase / Task**: M2 Data/bootstrap — T10 concluída
- **Completed**: instalação do `tlc-spec-driven`; Specify aprovado; Design aprovado; milestones M1–M8 e tasks T01–T36 criados; T01 bootstrap local implementado com smoke unitário e E2E; T02 PostgreSQL local e contrato de ambiente implementados; T03 Prisma client, schema PostgreSQL mínimo e validação configurados; T04 shell responsivo com navegação desktop/mobile e smoke E2E; T05 primitives compartilhadas de UI e estados de feedback implementados com 7 testes unitários; T06 modelos Prisma de Pessoa e Conta, enums de papel/status, unicidades, migration e testes de integração implementados; T07 modelos Prisma de Ministério, vínculos históricos e escopos independentes de líder, migration e testes de integração implementados; T08 modelos Prisma de categorias, séries recorrentes, encontros, públicos e presença, migration e testes de integração implementados; T09 modelos Prisma de notas, versões, timeline e auditoria, migration e testes de integração implementados; T10 seed administrativo, cálculo de idade e utilitários de data em `America/Sao_Paulo` implementados; OpenCode Ralph Loop guardado por `.specs/loop-state.json`
- **In-progress** (file:line): `.specs/features/emaus-mvp/tasks.md:199` — T11 aguardando execução
- **Next step**: executar T11, adicionando hashing Argon2 e validação de credenciais.
- **Blockers**: nenhum para T10. OpenCode é o runner do loop; modelo permanece configurável por `OPENCODE_MODEL`. O loop para se uma task falhar, não fizer commit, deixar árvore suja ou não avançar `.specs/loop-state.json`; deploy, e-mail, backup e monitoramento permanecem postergados para depois da validação local.
- **Uncommitted files**: nenhum
- **Branch**: main
