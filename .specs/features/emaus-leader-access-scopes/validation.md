# Validação — Escopo ministerial de Líderes

**Data:** 27/09/2026  
**Branch observada:** `dev`  
**Banco de teste:** `emaus_e2e_leader_scopes` (isolado; nenhum teste desta frente apontou para o banco de desenvolvimento)  
**Status:** Integrações, E2E e build isolado aprovados nas execuções históricas abaixo. A verificação independente de 28/09/2026 encontrou 3 lacunas de evidência de aceite e um sensor inconclusivo. O build consolidado mais recente passou; o timeout da suíte de capacidade é um resultado separado.

## Evidências TDD

| Tarefa | RED observado | GREEN observado |
|---|---|---|
| T1 — grant/revoke | 3 asserções falharam antes de ajustar idempotência, revoke repetido e data de regrant. | `access-scope-service.integration.test.ts`: 6 testes passaram, incluindo consulta do painel Admin e negação de grant/revoke a não administradores. |
| T2 — lista de Ministérios | 1 asserção falhou: Líder com grant no banco e array de sessão vazio não recebia Ministério. | `ministry-service.integration.test.ts`: 6 testes passaram, incluindo revogação e conta inativa. |
| T3 — visitante transacional | A primeira tentativa de teste teve falha de resolução de import e foi descartada como RED de infraestrutura. | `quick-visitor-service.integration.test.ts`: 5 testes passaram, incluindo escopo revogado/inativo, persistência e rollback integral. |
| T4 — adaptador de frequência | RED comportamental: a entrada pública negou Líder com escopo vigente pela permissão genérica de Pessoas. | Adapter e serviço: 11 testes passaram; retorno verifica `attendanceId`, `personId`, nome e `NOT_CONFIRMED`, além de timeline/auditoria. |
| T5 — consulta de configuração Admin | Implementação semanticamente vazia retornou `[]` e falhou ao omitir o grant atual esperado no painel. | `access-scope-service.integration.test.ts`: 6 testes passaram com Líder e grants vigentes. |

## Gates já executados

| Gate | Resultado |
|---|---|
| Integrações focadas dos quatro serviços | 4 arquivos, 23 testes passaram. Executados com `DATABASE_URL` sobrescrita para `emaus_e2e_leader_scopes`. |
| `rtk npm run typecheck` | Passou. |
| `rtk npm run lint` | Sem erros; um warning preexistente de `<img>` em `src/app/(dashboard)/pessoas/[personId]/page.tsx`. |
| `rtk npm run build` | Passou no gate isolado da frente, apontando para o DB descartável `emaus_e2e_leader_scopes`; exit 0. |
| E2E Admin/Líder | `e2e/leader-access-scopes.spec.ts`: 1 teste passou em Chromium (59,1s totais), porta `3104`, DB dedicado. O processo Playwright encerrou o servidor; porta ficou livre. |
| Regressão combinada atual | Typecheck falha porque `src/features/auth/account-service.integration.test.ts` importa `resetAccountPassword`, não exportado pelo serviço; full unit-only: 51/52, com falha em `src/app/(dashboard)/encontros/page.test.tsx` pela ausência do link de categorias. Ambos são fora desta frente. A integração global não foi repetida após o incidente de isolamento. |

O build consolidado de produção também passou em 2026-09-28 usando o runner com PostgreSQL temporário em tmpfs. Em seguida, o teste separado de capacidade `e2e/capacity.spec.ts` excedeu 180 s e falhou no teardown do trace; o container foi removido. O E2E funcional Admin/Líder desta frente permanece 1/1.

## Critérios de aceite — resumo histórico de 27/09

| Requisito | Evidência planejada/obtida | Estado |
|---|---|---|
| LEAD-01: lista somente Ministérios ativos concedidos; detalhe e Pessoas permanecem no escopo atual/histórico permitido; revoke bloqueia acessos futuros. | Integração de `ministry-service`; E2E Admin/Líder em `e2e/leader-access-scopes.spec.ts`. | Passou. |
| LEAD-02: Admin concede/revoga; mudanças são auditadas com before/after; repetição de grant/revoke permanece consistente; usuário sem Admin é recusado. | Integração de `access-scope-service`; E2E de configurações e auditoria. | Passou. |
| LEAD-03: Líder registra visitante somente pela frequência autorizada; presença começa `NOT_CONFIRMED`; timeline/auditoria acompanham Pessoa; falha transacional não deixa órfãos; cadastro genérico continua negado. | Integrações de `quick-visitor-service`/`attendance-query`; E2E Admin/Líder, incluindo reload do quadro. | Passou. |

## Incidentes de validação relacionados

## Sequência do E2E serial

- As primeiras tentativas encontraram locators estritos ambíguos (o select de Papel, um botão de revoke e o option/card com o mesmo nome). Eles foram escopados por ID e card.
- A quinta execução chegou ao cadastro contextual, confirmou a linha depois de `reload()` e uma única Attendance, mas parou no assert do erro de cadastro geral porque o route announcer também possui `role=alert`. O assert passou a selecionar `p[role='alert']`.
- A sexta execução usou navegação `domcontentloaded`; o submit client ocorreu antes dos handlers React estarem prontos. O snapshot ainda mostrava uma única presença e nenhum feedback/POST. Essa execução foi classificada como falha de sincronização/hidratação do teste, não como falha funcional do serviço.
- A sétima execução aguardou o evento `load` somente no quadro de frequência e observou o POST da Server Action antes dos asserts de feedback e linha. Resultado: 1/1 passou, inclusive visitante após reload, presença única, grant/revoke auditados e bloqueios pós-revoke.
- A suíte anterior de frequência também teve um timeout curto de 5s no locator do visitante. O snapshot tardio mostrou feedback “Visitante adicionado.”, linha e resumo atualizados; a frente de frequência aumentou a espera local. Esta frente não editou action/quadro/spec de frequência.

## Runner E2E para futuras execuções

As evidências acima foram coletadas em um DB descartável isolado antes de existir o wrapper temporário atual. Novas execuções devem usar `rtk run -c 'PLAYWRIGHT_PORT=3104 npm run test:e2e -- e2e/leader-access-scopes.spec.ts'`; o runner cria PostgreSQL memory-backed e rejeita endpoints compartilhados/remotos. Não invoque Playwright diretamente.

Lint final passou sem erros, com um warning existente de `<img>`; `db:validate` e `git diff --check` passaram. O typecheck global e o unit-only seguem com as falhas externas listadas acima.

## Verificação independente — 2026-09-28

**Escopo:** critérios de `.specs/features/emaus-leader-access-scopes/spec.md`, tarefas T1–T5, serviços atuais, testes de integração e `e2e/leader-access-scopes.spec.ts`. O verificador não alterou código nem testes. As tarefas de implementação estão marcadas como concluídas; esta revisão encontrou lacunas de cobertura descritas abaixo.

### Critérios de aceite ancorados na especificação

| Critério | Resultado definido na especificação | `arquivo:linha` + assertion | Resultado |
|---|---|---|---|
| LEAD-01.1 — lista de Ministérios | Cada Ministério ativo com concessão vigente aparece; Ministérios fora do escopo não aparecem. | `src/features/ministerios/ministry-service.integration.test.ts:126-134` — lista esperada contém somente `{ id: scopedMinistryId, status: "ACTIVE" }`; `e2e/leader-access-scopes.spec.ts:142-146` — link concedido visível, não concedido ausente e detalhe externo `404`. | ✅ PASS |
| LEAD-01.2 — nenhum acesso vigente | Exibir estado vazio explícito que não sugira inexistência global de Ministérios. | `e2e/leader-access-scopes.spec.ts:124-128` — texto exato `Você não tem acesso atual a nenhum Ministério.` e redirecionamento do encontro sem escopo. | ✅ PASS |
| LEAD-01.3 — detalhe concedido | Permitir consulta de participantes atuais e históricos do Ministério concedido. | `e2e/leader-access-scopes.spec.ts:149-154` — resposta `200`, títulos e participantes atuais/históricos visíveis. | ✅ PASS |
| LEAD-01.4 — Pessoa sem vínculo permitido | Negar antes de expor Pessoa sem vínculo atual ou histórico ao Ministério concedido. | `e2e/leader-access-scopes.spec.ts:156-159` — Pessoa vinculada a outro Ministério retorna `404`; a Pessoa com vínculo permitido retorna `200`. | ✅ PASS |
| LEAD-01.5 — revogação em leitura futura | Lista, detalhe e operação futura são negados após revoke; registros e autoria anteriores permanecem. | `src/features/ministerios/ministry-service.integration.test.ts:136-144` — lista vazia e perfil `null`; `e2e/leader-access-scopes.spec.ts:206-212` — estado vazio, perfil `404`, encontro redirecionado; `src/features/ministerios/access-scope-service.integration.test.ts:82-96` — mesmo registro de escopo persiste e auditoria preserva autor/before/after. | ✅ PASS |
| LEAD-02.1 — concessão | Grant é persistido e passa a permitir a visualização do Líder. | `src/features/ministerios/access-scope-service.integration.test.ts:52-74` — `accountId`, `ministryId`, `revokedAt: null`, idempotência; `e2e/leader-access-scopes.spec.ts:134-145` — controles Admin e link do Líder. | ✅ PASS |
| LEAD-02.2 — revogação | Novas consultas/operações são bloqueadas sem apagar o registro anterior. | `src/features/ministerios/access-scope-service.integration.test.ts:77-96` — mesmo `accessId`, data de revoke preservada em tentativa repetida e evento `REVOKE`; `e2e/leader-access-scopes.spec.ts:188-211` — revoke e bloqueios posteriores. | ✅ PASS |
| LEAD-02.3 — ator não Administrador | Grant e revoke são negados no serviço servidor. | `src/features/ministerios/access-scope-service.integration.test.ts:129-143` — ambos rejeitam com `Apenas administradores` e grant continua vigente; `e2e/leader-access-scopes.spec.ts:214-216` — acesso à tela redirecionado. | ✅ PASS |
| LEAD-02.4 — entradas inválidas | Conta ausente/não Líder ou Ministério arquivado/ausente são rejeitados sem grant parcial. | `src/features/ministerios/access-scope-service.integration.test.ts:145-153` — cobre não Líder, Ministério arquivado e inexistente com contagens zero; **não chama grant com conta inexistente**. | ⚠️ GAP parcial — falta assertion para conta inexistente |
| LEAD-02.5 — auditoria | Registrar autor, alvo, Ministério, ação, data/hora e valores anteriores/posteriores aplicáveis. | `src/features/ministerios/access-scope-service.integration.test.ts:70-74,85-90` e `e2e/leader-access-scopes.spec.ts:192-204` — verificam autor, alvo, ação/Ministério e `revokedAt` antes/depois; não verificam `AuditEvent.createdAt` nem `grantedAt` nos snapshots de grant/regrant. | ⚠️ GAP parcial — timestamp e snapshot de grant não têm assertion |
| LEAD-02.6 — configuração Admin | Mostrar concessões vigentes; identificar revogadas se histórico for exibido. | `src/features/ministerios/access-scope-service.integration.test.ts:112-126` — lista exata de concessões vigentes e exclui registro revogado; `e2e/leader-access-scopes.spec.ts:138-140,188-192` — concessão visível e controle de revoke removido após revogação. A tela atual não exibe histórico de revogadas. | ✅ PASS |
| LEAD-03.1 — cadastro contextual | Com somente nome completo, criar Pessoa `VISITOR` e presença `NOT_CONFIRMED` no encontro permitido. | `src/features/encontros/quick-visitor-service.integration.test.ts:119-130` — chamada só com `fullName`, `meetingId`, status e campos opcionais nulos; `e2e/leader-access-scopes.spec.ts:164-175` — formulário, status visível e presença ligada ao encontro. | ✅ PASS |
| LEAD-03.2 — presença, timeline e auditoria | Mostrar visitante na lista e persistir presença inicial, timeline e auditoria de criação da Pessoa. | `src/features/encontros/quick-visitor-service.integration.test.ts:130-141` — uma presença, evento `REGISTRATION` e evento `CREATE`; `e2e/leader-access-scopes.spec.ts:169-180` — feedback/lista após reload, `NOT_CONFIRMED` e contagem de presença `1`. | ✅ PASS |
| LEAD-03.3 — fora do fluxo/alteração de Pessoa | Negar cadastro fora da frequência e alteração de cadastro fora do escopo, sem conceder gestão geral de Pessoas. | `e2e/leader-access-scopes.spec.ts:182-186` — cadastro genérico negado sem criar Pessoa; `src/server/authorization.test.ts:39-52` — `canManagePeople(leader) === false`. Não há teste de Líder tentando `promoteToMember` ou `inactivatePerson`. | ⚠️ GAP parcial — falta assertion da operação de alteração no serviço |
| LEAD-03.4 — encontro sem escopo vigente | Negar antes de criar Pessoa, presença, timeline ou auditoria. | `src/features/encontros/quick-visitor-service.integration.test.ts:144-165` — escopo revogado ou outro Ministério rejeita e as quatro contagens/consultas ficam vazias; `:168-175` — conta inativa também não cria Pessoa/presença. | ✅ PASS |
| LEAD-03.5 — falha transacional | Falha após criar Pessoa não deixa Pessoa, presença, timeline ou auditoria órfãs. | `src/features/encontros/quick-visitor-service.integration.test.ts:185-197` — falha de auditoria injetada e as quatro verificações retornam zero/nulo. | ✅ PASS |

**Cobertura:** 13/16 critérios cobertos integralmente; 3/16 têm lacuna parcial. **Lacunas de precisão da especificação:** nenhuma; os resultados esperados são verificáveis.

### Casos de borda

| Caso | Evidência | Resultado |
|---|---|---|
| Acesso sem vínculo ministerial da Pessoa | `src/features/ministerios/access-scope-service.integration.test.ts:59-62` — concessão vigente com `ministryMembership.count === 0`. | ✅ Coberto |
| Vários Ministérios ativos concedidos à mesma conta | `src/features/ministerios/ministry-service.integration.test.ts:126-130` espera um único Ministério ativo concedido; não há fixture com dois grants ativos. | ⚠️ Sem assertion para múltiplos grants ativos |
| Grant para Ministério arquivado | `src/features/ministerios/access-scope-service.integration.test.ts:145-153` — rejeita e confirma zero grants. | ✅ Coberto |
| Grant/revoke repetidos | `src/features/ministerios/access-scope-service.integration.test.ts:64-74,77-109` — grant idempotente, revoke repetido não sobrescreve data e regrant atualiza o mesmo registro. | ✅ Coberto |
| Conta inativa | `src/features/ministerios/ministry-service.integration.test.ts:146-154`; `src/features/encontros/quick-visitor-service.integration.test.ts:168-175` — lista/perfil negados e visitante não persistido. | ✅ Coberto |
| Lista vazia não confundida com inexistência global | `e2e/leader-access-scopes.spec.ts:124-126` — estado vazio explícito. | ✅ Coberto |

### Gate e integridade de testes

- **E2E funcional Admin/Líder:** 1/1 passou, conforme execução atual informada pelo coordenador; os critérios funcionais abaixo não se confundem com o timeout de capacidade.
- **Build consolidado:** `next build` passou na execução consolidada mais recente em 2026-09-28, conforme coordenador. O build isolado anterior também consta acima como aprovado.
- **Capacidade:** a execução separada de `e2e/capacity.spec.ts` expirou em 180 s no teardown do trace; é resultado de outra suíte, não falha do E2E Admin/Líder.
- **Integrações:** a evidência histórica registra 23 testes aprovados em quatro arquivos. A inspeção atual encontra 24 declarações `it()` nos quatro arquivos; esta verificação não reexecutou os testes DB-backed diretamente e não afirma que os 24 passaram na mesma execução. Não encontrei evidência de teste removido.
- **Typecheck/lint/regressão anterior:** permanecem os resultados históricos acima; a falha de typecheck e a falha unitária foram atribuídas a arquivos fora desta frente. O `next build` consolidado é reportado separadamente.

### Sensor de discriminação

| Mutação | Resultado |
|---|---|
| Em worktree descartável, forçar a consulta da lista do Líder a `id: { in: [] }`; executar `rtk run -c 'PLAYWRIGHT_PORT=3114 npm run test:e2e -- e2e/leader-access-scopes.spec.ts'` via runner do projeto. | **Inconclusivo** — o runner criou DB PostgreSQL temporário em tmpfs e passou os 2 guard tests, mas o E2E expirou após 180 s navegando ao encontro sem escopo (`e2e/leader-access-scopes.spec.ts:127`, `page.goto`/`ERR_ABORTED`), antes do grant e da assertion da lista concedida (`:142`). Não classificar como mutant morto nem sobrevivente. Worktree/container foram removidos. Nenhuma conexão ao banco de `.env` foi usada. |

**Profundidade:** 1 mutação leve tentada; 0 mortas, 0 sobreviventes, 1 inconclusiva por timeout anterior à assertion-alvo. Sem nova tentativa conforme coordenação de slots.

### Qualidade e planos de correção

| Verificação | Estado |
|---|---|
| Código usa os helpers existentes de autorização, transação e auditoria; sem abstração ou expansão evidente além do escopo. | ✅ |
| Alterações de verificação limitaram-se a este relatório; nenhum source/teste compartilhado foi modificado. | ✅ |
| Padrões documentados consultados: `AGENTS.md`, `package.json`, `playwright.config.ts` e `.agents/skills/tlc-spec-driven/references/coding-principles.md`. | ✅ |
| Testes por camada cobrem cada critério e edge case sem lacunas. | ❌ — 3 lacunas de AC e 1 caso de múltiplos grants ativos sem assertion. |

**Planos de correção sugeridos:**

1. Em `src/features/ministerios/access-scope-service.integration.test.ts`, tentar grant para um `accountId` inexistente e verificar rejeição e ausência de grant parcial.
2. Na mesma suíte, afirmar `createdAt` como data no evento e conferir `grantedAt` nos snapshots before/after de grant e regrant.
3. Em `src/features/pessoas/status-service.integration.test.ts`, tentar promoção/inativação como Líder com escopo e provar rejeição sem alteração de Pessoa/timeline/auditoria.
4. Em `src/features/ministerios/ministry-service.integration.test.ts`, conceder dois Ministérios ativos à mesma conta e afirmar que ambos são listados, preservando a exclusão do não concedido/arquivado.

## Resumo do Verificador

**Veredito:** ❌ FAIL — lacunas de evidência; não foi observada falha funcional nos 13 critérios cobertos.

**Critérios:** 13/16 cobertos integralmente; 3 parciais. **Gate:** E2E Admin/Líder 1/1 e build consolidado aprovados; timeout de capacidade separado. **Sensor:** 1 tentativa inconclusiva, sem conclusão de morto/sobrevivente.

**O que funciona:** listagem e detalhe por escopo, estado vazio, bloqueios após revoke, controle Admin, auditoria de ações sem timestamp testado, cadastro contextual e rollback.

**Lacunas:** conta inexistente, timestamp/snapshot de grant na auditoria, operação de alteração de Pessoa por Líder e cenário de múltiplos grants ativos.

**Próximo passo:** adicionar as assertions listadas nos planos e repetir o sensor em uma execução sem contenção de browser.
