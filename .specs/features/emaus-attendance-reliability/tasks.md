# Frequência confiável e auditável — tarefas

## Protocolo de execução

Executar com a skill `tlc-spec-driven`: uma tarefa por vez, testes derivados dos ACs, gate obrigatório e um commit atômico por tarefa. Nesta rodada paralela, o agente coordenador fará os commits por paths explícitos depois dos gates; não incluir arquivos de outras frentes.

O E2E global executa `prisma migrate reset --force`. `ATTENDANCE_E2E_DATABASE_URL` deve apontar somente para o banco descartável `emaus_attendance_worker1_e2e_20260927`, após confirmar `current_database`, usuário e destino local. Use `PLAYWRIGHT_PORT=3101` durante esta rodada. Nunca copie o valor da URL para docs ou logs.

**Design**: `.specs/features/emaus-attendance-reliability/design.md`
**Status**: Complete — validação da frente concluída em 2026-09-27.
**Validação**: `.specs/features/emaus-attendance-reliability/validation.md`

## Test Coverage Matrix

> Gerada do código, configurações do projeto e spec. Guidelines encontradas: `README.md` descreve o fluxo de execução, sem threshold ou regra de cobertura; `vitest.config.ts`, `playwright.config.ts` e `package.json` definem localização e comandos. Instruções da sessão (`AGENTS.md`) definem uso de Orca/RTK, sem profundidade de testes. Aplicar strong defaults: cobertura integral dos ACs e casos de borda.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Ciclo e invariantes de presença | unit + integration | Cada estado e AC do serviço; estados esperados repetidos, autorização, cancelamento, arquivo e rollback de escrita histórica | `src/features/encontros/attendance-service*.test.ts` | `npm test -- src/features/encontros/attendance-service.test.ts src/features/encontros/attendance-service.cycle.test.ts src/features/encontros/attendance-service.integration.test.ts` |
| Server Action e quadro React | e2e | Abertura/reabertura, ciclo confirmado, clique duplicado, loading por linha, falha/reversão/retry, estado após reload; perfis Admin, Secretaria e Líder em/fora do escopo | `e2e/attendance.spec.ts` | `PLAYWRIGHT_PORT=3101 npm run test:e2e -- e2e/attendance.spec.ts` |
| Consulta de auditoria | integration | Alvo Attendance apresenta pessoa/encontro; eventos sem contexto preservam consulta; autorização administrativa continua obrigatória | `src/features/auditoria/audit-query.integration.test.ts` | `npm test -- src/features/auditoria/audit-query.integration.test.ts` |
| Tela de auditoria/timeline | e2e | Evento identifica pessoa/encontro e antes/depois no alvo certo; timeline mostra pessoa, encontro e transição | `e2e/attendance.spec.ts` | `PLAYWRIGHT_PORT=3101 npm run test:e2e -- e2e/attendance.spec.ts` |
| Página, schema e config sem regra nova | none | Build e typecheck | — | `npm run build && npm run typecheck` |

## Gate Check Commands

> Confirmados em `package.json`, `vitest.config.ts` e `playwright.config.ts`. Antes do teste Vitest com banco, aplique `prisma migrate deploy` no DB descartável. O E2E reseta e semeia somente esse DB.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Serviço ou consulta com testes Vitest | `DATABASE_URL="$ATTENDANCE_E2E_DATABASE_URL" npx prisma migrate deploy && DATABASE_URL="$ATTENDANCE_E2E_DATABASE_URL" npm run test -- [arquivos Vitest da tarefa]` |
| Full | Mudança de interface/rota coberta por E2E | `DATABASE_URL="$ATTENDANCE_E2E_DATABASE_URL" npx prisma migrate deploy && DATABASE_URL="$ATTENDANCE_E2E_DATABASE_URL" npm run test -- src/features/encontros/attendance-service.test.ts src/features/encontros/attendance-service.cycle.test.ts src/features/encontros/attendance-service.integration.test.ts src/features/auditoria/audit-query.integration.test.ts && DATABASE_URL="$ATTENDANCE_E2E_DATABASE_URL" PLAYWRIGHT_PORT=3101 npm run test:e2e -- e2e/attendance.spec.ts` |
| Build | Fechamento desta frente | `npm run build && npm run lint && npm run typecheck && DATABASE_URL="$ATTENDANCE_E2E_DATABASE_URL" npx prisma migrate deploy && DATABASE_URL="$ATTENDANCE_E2E_DATABASE_URL" npm test && DATABASE_URL="$ATTENDANCE_E2E_DATABASE_URL" PLAYWRIGHT_PORT=3101 npm run test:e2e -- e2e/attendance.spec.ts` |

O E2E de fechamento desta frente cobre os sete casos de `e2e/attendance.spec.ts`; o E2E global do workspace fica para a coordenação após estabilizar as outras frentes paralelas.

## Plano de execução

### Fase 1: Contrato e planejamento

```text
T1
```

### Fase 2: Persistência de uma transição

```text
T1 → T2
```

### Fase 3: Interface e histórico legível

```text
T2 → (T3, T4) → T5
```

## Quebra de tarefas

### T1: Registrar design e plano de testes

**What**: Documentar pressupostos, arquitetura, riscos, arquivos-alvo, matriz de cobertura, comandos de gate e dependências.
**Where**: `.specs/features/emaus-attendance-reliability/design.md`, `.specs/features/emaus-attendance-reliability/tasks.md`
**Depends on**: None
**Reuses**: Spec, decisões AD-004/AD-007, `attendance-service`, configurações e testes existentes.
**Requirement**: FREQ-01 a FREQ-05

**Tools**:
- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:
- [x] Todas as premissas, opções avaliadas, componentes e riscos têm mitigação.
- [x] Matriz de cobertura inclui ACs/casos de borda, localização e comandos reais.
- [x] Diagrama e dependências coincidem; tarefas são atômicas e têm testes co-localizados.
- [x] `rtk proxy git diff --check --no-index /dev/null <documento>` não reporta erros de whitespace nos documentos ainda não rastreados.

**Tests**: none — documentação
**Gate**: quick
**Status**: ✅ Complete — matriz, riscos, dependências e comandos registrados.

### T2: Proteger a transição persistida por estado esperado

**What**: Fazer compare-and-set da presença e manter atualização, auditoria e timeline na mesma transação.
**Where**: `src/features/encontros/attendance-service.ts`, `src/features/encontros/attendance-service.integration.test.ts`
**Depends on**: T1
**Reuses**: `nextAttendanceStatus`, `canManageMeeting`, `withTransaction`, funções `recordAuditEvent`/`recordTimelineEvent`.
**Requirement**: FREQ-01, FREQ-02, FREQ-03, FREQ-05

**Tools**:
- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:
- [x] Uma transição só ocorre se o estado persistido for igual ao estado esperado recebido.
- [x] Estado esperado obsoleto devolve estado persistido sem segunda transição ou eventos duplicados.
- [x] Testes provam sequência, alvo/ator/horário/antes/depois/motivo, evento de timeline, negação fora de escopo, cancelamento, arquivo e rollback se a auditoria falhar.
- [x] Gate Quick passa, sem testes apagados/ignorados e com resultado derivado dos ACs.

**Tests**: integration — service/transaction
**Gate**: quick
**Status**: ✅ Complete — 13 passed, 0 failed, 0 skipped; baseline 9 tests, +4.

### T3: Tornar o ciclo visual resiliente a cliques e falhas

**What**: Passar o estado observado pela Server Action, bloquear sincronamente a mesma linha, tratar rejeição/erro, reverter, oferecer retry e reconciliar resposta/conflicto.
**Where**: `src/app/(dashboard)/encontros/[meetingId]/actions.ts`, `src/app/(dashboard)/encontros/[meetingId]/attendance-board.tsx`, `e2e/attendance.spec.ts`
**Depends on**: T2
**Reuses**: Session/action existentes, mensagens de domínio, status e botão de retry.
**Requirement**: FREQ-01, FREQ-05

**Tools**:
- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:
- [x] A linha pendente não aceita outro clique; outras linhas não ficam bloqueadas sem necessidade.
- [x] A UI mostra o status persistido retornado pelo servidor, reverte em falha e mostra retry sem sucesso falso.
- [x] Retry após falha atualiza a linha; resposta obsoleta apenas sincroniza o status, sem nova transição.
- [x] E2E em Playwright demonstra sequência após reload, falha/reversão/retry e perfis autorizados Admin, Secretaria e Líder em escopo; Líder fora do escopo não vê o quadro.
- [x] Gate Full passa no banco descartável, sem contagem de testes reduzida.

**Tests**: e2e — quadro e fluxo real de sessão/autorização
**Gate**: full
**Status**: ✅ Complete — E2E attendance 7/7; testes de serviço e typecheck passaram.

### T4: Resolver contexto de Pessoa e Encontro na consulta de auditoria

**What**: Resolver em uma consulta em lote o contexto para os eventos cujo alvo é `Attendance`.
**Where**: `src/features/auditoria/audit-query.ts`, `src/features/auditoria/audit-query.integration.test.ts`
**Depends on**: T2
**Reuses**: autorização e seleção de eventos atual; relações existentes `Attendance.person` e `Attendance.meeting`.
**Requirement**: FREQ-02, FREQ-04

**Tools**:
- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:
- [x] Evento de frequência retorna nome da Pessoa e título do Encontro corretos por consulta em lote.
- [x] Evento cujo alvo não existe conserva `targetType`/`targetId` e retorna contexto nulo.
- [x] Consulta permanece negada para não administrador.
- [x] Gate Quick passa com assertions nos valores definidos pela spec.

**Tests**: integration — query de auditoria
**Gate**: quick
**Status**: ✅ Complete — RED 2 assertions ausentes; GREEN 4/4, além do Vitest integral 154/154.

### T5: Apresentar alvo de frequência e transição na auditoria e timeline

**What**: Exibir nomes de Pessoa e Encontro junto ao ID técnico do evento e validar a ocorrência real na auditoria/timeline pelo browser E2E.
**Where**: `src/app/(dashboard)/configuracoes/auditoria/page.tsx`, `e2e/attendance.spec.ts`
**Depends on**: T3, T4
**Reuses**: lista administrativa de auditoria, payload antes/depois e rota de timeline existente.
**Requirement**: FREQ-02, FREQ-03, FREQ-04

**Tools**:
- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:
- [x] Evento de presença mostra Pessoa, Encontro, ator, data/hora, antes/depois e motivo quando informado.
- [x] Timeline da Pessoa mostra o Encontro e a transição realizada.
- [x] Eventos de outros tipos mantêm a apresentação existente.
- [x] Gate Build passa: build, lint, typecheck, Vitest e E2E completo desta frente no banco descartável validado.

**Tests**: e2e — evento real de presença e consulta/timeline
**Gate**: build
**Status**: ✅ Complete — build/lint/typecheck/Vitest verdes; E2E attendance 7/7.

## Mapa de execução

```text
Fase 1 → Fase 2 → Fase 3

Fase 1: T1
Fase 2: T1 ──→ T2
Fase 3: T2 ──→ T3 ──→ T5
               └────→ T4 ──→ T5
```

## Validações do plano

### Granularidade

| Task | Escopo | Resultado |
|---|---|---|
| T1 | Dois documentos relacionados do próprio recurso | ✅ Granular |
| T2 | Uma função de domínio e seus testes co-localizados | ✅ Granular |
| T3 | Um fluxo de interação do quadro, ação e E2E correspondente | ✅ Coeso |
| T4 | Uma consulta de auditoria e testes da consulta | ✅ Granular |
| T5 | Uma apresentação E2E do evento de presença e teste do fluxo | ✅ Coeso |

### Diagrama e dependências

| Task | Depends on | Setas no mapa | Resultado |
|---|---|---|---|
| T1 | Nenhuma | Nenhuma | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T2 | T2 → T4 | ✅ |
| T5 | T3, T4 | T3 → T5 e T4 → T5 | ✅ |

### Testes co-localizados com a matriz

| Task | Camada criada/modificada | Matriz requer | Task inclui | Resultado |
|---|---|---|---|---|
| T1 | Documentação | none | `git diff --check` | ✅ |
| T2 | Domínio/serviço | integration | Testes de serviço no mesmo task | ✅ |
| T3 | Server Action/UI | e2e | E2E do quadro e papéis no mesmo task | ✅ |
| T4 | Query/repository | integration | Testes da consulta no mesmo task | ✅ |
| T5 | Página UI | e2e | E2E da auditoria/timeline no mesmo task | ✅ |

## Situação dos testes antes da implementação

- `attendance-service.test.ts`: 2 casos unitários de elegibilidade.
- `attendance-service.cycle.test.ts`: 1 caso unitário para os três estados.
- `attendance-service.integration.test.ts`: 6 casos, incluindo ciclo/histórico, cancelamento, arquivo e idempotência de abertura.
- `attendance-query.integration.test.ts`: 5 casos de busca/adicionar/resumo; fora do escopo desta frente.
- `audit-query.integration.test.ts`: 2 casos de leitura administrativa.
- `e2e/attendance.spec.ts`: 4 casos; E2E atual cobre Administrador, mas não Secretaria/Líder.
- `e2e/audit.spec.ts`: 2 casos de dados sensíveis/permissão administrativa.

## Execução e commits

Cada tarefa será validada antes de ser marcada completa. Como as frentes correm em paralelo, não fazer `git add` ou `git commit`; a coordenação fará commits atômicos com paths explícitos depois dos gates.

## Revisão de adequação — T2

### Cobertura por AC e critério de conclusão

| AC/critério | Evidência `file:line` + assertion | Resultado esperado na spec | Status |
|---|---|---|---|
| FREQ-01, história de lançamento, AC1: inicial e reabertura | `src/features/encontros/attendance-service.integration.test.ts:166` — `expect(first).toHaveLength(1)`; `:167` — `expect(first[0]).toMatchObject({ personId: personIds[0], meetingId, status: "NOT_CONFIRMED" })`; `:171` — `expect(reopened).toHaveLength(1)`; `:172` — `expect(reopened[0].status).toBe("PRESENT")`; `:173` — `expect(prisma.attendance.count({ where: { meetingId } })).resolves.toBe(1)` | Pessoa elegível começa `NOT_CONFIRMED`; reabrir não duplica | ✅ |
| FREQ-01, AC2: sequência persistida | `src/features/encontros/attendance-service.integration.test.ts:56` — `expect(present).toEqual({ status: "PRESENT", changed: true })`; `:58` — `expect(absent).toEqual({ status: "ABSENT", changed: true })`; `:60` — `expect(notConfirmed).toEqual({ status: "NOT_CONFIRMED", changed: true })`; `src/features/encontros/attendance-service.cycle.test.ts:6` — `expect(nextAttendanceStatus("NOT_CONFIRMED")).toBe("PRESENT")`; `:7` — `expect(nextAttendanceStatus("PRESENT")).toBe("ABSENT")`; `:8` — `expect(nextAttendanceStatus("ABSENT")).toBe("NOT_CONFIRMED")` | NOT_CONFIRMED → PRESENT → ABSENT → NOT_CONFIRMED | ✅ |
| FREQ-01, AC3: não avançar em solicitação simultânea | `src/features/encontros/attendance-service.integration.test.ts:91` — `expect(results.map(({ status }) => status)).toEqual(["PRESENT", "PRESENT"])`; `:92` — `expect(results.filter(({ changed }) => changed)).toHaveLength(1)`; `:93` — `expect(results.filter(({ changed }) => !changed)).toHaveLength(1)`; `:94` — `await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "PRESENT" })`; `:95` — `await expect(prisma.auditEvent.count({ where: { targetId: attendance.id, targetType: "Attendance" } })).resolves.toBe(1)`; `:96` — `await expect(prisma.timelineEvent.count({ where: { personId: attendance.personId, category: "ATTENDANCE" } })).resolves.toBe(1)` | No máximo uma transição por estado esperado; estado persistido PRESENT | ✅ |
| FREQ-01, AC4: erro de persistência não deixa gravação parcial | `src/features/encontros/attendance-service.integration.test.ts:105` — `await expect(cycleAttendance({ id: failedActor.id, role: "ADMINISTRATOR", ministryAccess: [] }, attendance.id, "NOT_CONFIRMED")).rejects.toThrow()`; `:106` — `await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" })`; `:107` — `await expect(prisma.auditEvent.count({ where: { targetId: attendance.id } })).resolves.toBe(0)`; `:108` — `await expect(prisma.timelineEvent.count({ where: { personId: attendance.personId, category: "ATTENDANCE" } })).resolves.toBe(0)` | Operação falha sem estado/histórico parcial | ✅ |
| FREQ-01, AC5: retry com estado antigo não transita outra vez | `src/features/encontros/attendance-service.integration.test.ts:75` — `await expect(cycleAttendance(actor, attendance.id, "NOT_CONFIRMED")).resolves.toEqual({ status: "PRESENT", changed: true })`; `:76` — `await expect(cycleAttendance(actor, attendance.id, "NOT_CONFIRMED")).resolves.toEqual({ status: "PRESENT", changed: false })`; `:77` — `await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "PRESENT" })`; `:78` — auditoria count 1; `:79` — timeline count 1 | No máximo uma transição para retry; estado do servidor continua PRESENT | ✅ |
| FREQ-02, história de histórico, AC1: autoria/data/antes/depois/motivo | `src/features/encontros/attendance-service.integration.test.ts:63` — `expect(audit).toMatchObject({ actorId: accountId, targetType: "Attendance", targetId: attendance.id, action: "UPDATE", before: { status: "PRESENT" }, after: { status: "ABSENT" }, reason: "Correção após conferência" })`; `:64` — `expect(audit.createdAt).toBeInstanceOf(Date)`; `:66` — auditoria da primeira transição tem motivo null | Auditoria aponta entidade, ator, horário, estado anterior/posterior e motivo opcional | ✅ |
| FREQ-03, história de histórico, AC2: timeline da Pessoa | `src/features/encontros/attendance-service.integration.test.ts:68` — `expect(timeline).toMatchObject({ personId: personIds[0], title: "Presença atualizada", description: `Ministério T27 ${suffix}: PRESENT → ABSENT` })` | Evento ATTENDANCE na timeline da Pessoa com o Encontro e a transição | ✅ |
| FREQ-02, história de histórico, AC4: sem acesso não lista/altera | `src/features/encontros/attendance-service.integration.test.ts:118` — `await expect(getAttendanceBoard(outOfScopeLeader, meetingId)).rejects.toThrow("Encontro não encontrado.")`; `:119` — `await expect(cycleAttendance(outOfScopeLeader, attendance.id, "NOT_CONFIRMED")).rejects.toThrow("Presença não encontrada.")`; `:120` — attendance NOT_CONFIRMED | Negar e não expor/alterar presença | ✅ |
| FREQ-02, história de histórico, AC5: cancelamento/arquivo | `src/features/encontros/attendance-service.integration.test.ts:127` — rejeição por encontro cancelado; `:128` — estado NOT_CONFIRMED; `:144` — rejeição para primeiro lançamento após arquivo; `:145` — estado NOT_CONFIRMED; `:156` — histórico PRESENT reaberto; `:157` — correção ABSENT; `:158` — uma única linha de frequência | Rejeitar novo lançamento e manter histórico existente | ✅ |

### Reverse map — testes adicionados ou alterados

| `file:line` + assertion | Mapeamento | Manter? |
|---|---|---|
| `attendance-service.test.ts:13` — `expect(projectEligiblePersonIds(memberships, [])).toEqual(["person-a", "person-b", "person-c"])`; `:17` — `expect(projectEligiblePersonIds(memberships, ["ministry-b"])).toEqual(["person-a", "person-b"])` | Caso de borda: elegibilidade por audiência sem duplicar Pessoas | ✅ |
| `attendance-service.cycle.test.ts:6` — `expect(nextAttendanceStatus("NOT_CONFIRMED")).toBe("PRESENT")`; `:7` — `expect(nextAttendanceStatus("PRESENT")).toBe("ABSENT")`; `:8` — `expect(nextAttendanceStatus("ABSENT")).toBe("NOT_CONFIRMED")` | FREQ-01 AC2 | ✅ |
| `attendance-service.integration.test.ts:56` — `expect(present).toEqual({ status: "PRESENT", changed: true })`; `:58` — `expect(absent).toEqual({ status: "ABSENT", changed: true })`; `:60` — `expect(notConfirmed).toEqual({ status: "NOT_CONFIRMED", changed: true })` | FREQ-01 AC2 | ✅ |
| `attendance-service.integration.test.ts:63` — `expect(audit).toMatchObject({ actorId: accountId, targetType: "Attendance", targetId: attendance.id, action: "UPDATE", before: { status: "PRESENT" }, after: { status: "ABSENT" }, reason: "Correção após conferência" })`; `:64` — `expect(audit.createdAt).toBeInstanceOf(Date)`; `:66` — `expect(optionalReasonAudit).toMatchObject({ actorId: accountId, before: { status: "NOT_CONFIRMED" }, after: { status: "PRESENT" }, reason: null })`; `:68` — assert da timeline com personId, título e descrição exata | FREQ-02 AC1; FREQ-03 AC2 | ✅ |
| `attendance-service.integration.test.ts:75` — `await expect(cycleAttendance(actor, attendance.id, "NOT_CONFIRMED")).resolves.toEqual({ status: "PRESENT", changed: true })`; `:76` — mesma chamada retorna `{ status: "PRESENT", changed: false }`; `:77` — Attendance persiste PRESENT; `:78` — audit count é 1; `:79` — timeline count é 1 | FREQ-01 AC5 | ✅ |
| `attendance-service.integration.test.ts:91` — `expect(results.map(({ status }) => status)).toEqual(["PRESENT", "PRESENT"])`; `:92` — `expect(results.filter(({ changed }) => changed)).toHaveLength(1)`; `:93` — `expect(results.filter(({ changed }) => !changed)).toHaveLength(1)`; `:94` — Attendance PRESENT; `:95` — audit count 1; `:96` — timeline count 1 | FREQ-01 AC3 | ✅ |
| `attendance-service.integration.test.ts:105` — chamada com ator removido rejeita; `:106` — `await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" })`; `:107` — audit count 0; `:108` — timeline count 0 | FREQ-01 AC4 | ✅ |
| `attendance-service.integration.test.ts:118` — `await expect(getAttendanceBoard(outOfScopeLeader, meetingId)).rejects.toThrow("Encontro não encontrado.")`; `:119` — `await expect(cycleAttendance(outOfScopeLeader, attendance.id, "NOT_CONFIRMED")).rejects.toThrow("Presença não encontrada.")`; `:120` — Attendance NOT_CONFIRMED | FREQ-02 AC4; FREQ-05 | ✅ |
| `attendance-service.integration.test.ts:127` — `await expect(cycleAttendance(actor, attendance.id, "NOT_CONFIRMED")).rejects.toThrow("Encontro cancelado não aceita lançamentos de presença.")`; `:128` — estado NOT_CONFIRMED | FREQ-02 AC5 e borda de encontro cancelado | ✅ |
| `attendance-service.integration.test.ts:134` — `await expect(openAttendance(meetingId)).rejects.toThrow("Encontro cancelado não aceita lançamentos de presença.")`; `:135` — `await expect(prisma.attendance.count({ where: { meetingId } })).resolves.toBe(0)` | FREQ-01 AC1 e borda de encontro cancelado | ✅ |
| `attendance-service.integration.test.ts:144` — `await expect(cycleAttendance(actor, attendance.id, "NOT_CONFIRMED")).rejects.toThrow("Ministério arquivado não aceita novos lançamentos de presença.")`; `:145` — estado NOT_CONFIRMED | FREQ-02 AC5 e borda de Ministério arquivado | ✅ |
| `attendance-service.integration.test.ts:156` — histórico PRESENT reaberto; `:157` — `{ status: "ABSENT", changed: true }`; `:158` — Attendance count 1 | FREQ-02 AC5 e borda de histórico arquivado | ✅ |
| `attendance-service.integration.test.ts:166` — `expect(first).toHaveLength(1)`; `:167` — `expect(first[0]).toMatchObject({ personId: personIds[0], meetingId, status: "NOT_CONFIRMED" })`; `:171` — `expect(reopened).toHaveLength(1)`; `:172` — `expect(reopened[0].status).toBe("PRESENT")`; `:173` — count 1 | FREQ-01 AC1 e borda de reabertura sem duplicação | ✅ |

**Veredito**: os asserts têm valores ligados à spec, cada teste possui requisito atribuído e a cobertura de domínio inclui transação, conflito e bordas existentes. Sem assertions rasas ou testes fora do escopo.

### Gate e integridade

- **Comando**: `npx prisma migrate deploy`; `npm run test -- src/features/encontros/attendance-service.test.ts src/features/encontros/attendance-service.cycle.test.ts src/features/encontros/attendance-service.integration.test.ts` — `DATABASE_URL` foi injetada pelo runner sem imprimir o valor e apontava para o DB validado desta frente.
- **Resultado**: 13 passaram, 0 falharam, 0 ignorados.
- **Contagem**: 9 antes → 13 depois (+4); nenhum teste removido ou ignorado.
- **Diretrizes**: `vitest.config.ts`, `package.json`, `README.md`; profundidade conforme strong defaults, testes Vitest com DB.
- **Qualidade**: alterações limitadas ao serviço e sua integração; compare-and-set, timeline e auditoria permanecem no mesmo transaction callback; sem desvio da spec.
