# Validação — Escopo ministerial de Líderes

**Data:** 27/09/2026  
**Branch observada:** `dev`  
**Banco de teste:** `emaus_e2e_leader_scopes` (isolado; nenhum teste desta frente apontou para o banco de desenvolvimento)  
**Status:** A spec E2E estendida passou 1/1 isoladamente e novamente na rodada integrada final 31/31. As assertions para as lacunas independentes passaram em browser. Os testes de integração adicionados para conta ausente, snapshot de regrant e bloqueio de alteração de Pessoa continuam sem execução DB-backed; o cenário de múltiplos Ministérios ativos permanece sem assertion. O build consolidado histórico passou.

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
| LEAD-02.4 — entradas inválidas | Conta ausente/não Líder ou Ministério arquivado/ausente são rejeitados sem grant parcial. | `src/features/ministerios/access-scope-service.integration.test.ts:145-153,177-183` — cobre conta inexistente com rejeição `Conta não encontrada` e contagem de grants zero (integração pendente); `e2e/leader-access-scopes.spec.ts:136-140` repete o caso e passou no runner isolado. | ✅ E2E passou; integração pendente |
| LEAD-02.5 — auditoria | Registrar autor, alvo, Ministério, ação, data/hora e valores anteriores/posteriores aplicáveis. | `e2e/leader-access-scopes.spec.ts:228-235` — confirma `AuditEvent.createdAt` e `grantedAt` no grant inicial; E2E passou. `src/features/ministerios/access-scope-service.integration.test.ts:70-85,112-136` inclui assertions para grant/regrant, mas a suíte DB-backed ainda não foi executada. | 🟨 Grant inicial passou; snapshot de regrant pendente |
| LEAD-02.6 — configuração Admin | Mostrar concessões vigentes; identificar revogadas se histórico for exibido. | `src/features/ministerios/access-scope-service.integration.test.ts:112-126` — lista exata de concessões vigentes e exclui registro revogado; `e2e/leader-access-scopes.spec.ts:138-140,188-192` — concessão visível e controle de revoke removido após revogação. A tela atual não exibe histórico de revogadas. | ✅ PASS |
| LEAD-03.1 — cadastro contextual | Com somente nome completo, criar Pessoa `VISITOR` e presença `NOT_CONFIRMED` no encontro permitido. | `src/features/encontros/quick-visitor-service.integration.test.ts:119-130` — chamada só com `fullName`, `meetingId`, status e campos opcionais nulos; `e2e/leader-access-scopes.spec.ts:164-175` — formulário, status visível e presença ligada ao encontro. | ✅ PASS |
| LEAD-03.2 — presença, timeline e auditoria | Mostrar visitante na lista e persistir presença inicial, timeline e auditoria de criação da Pessoa. | `src/features/encontros/quick-visitor-service.integration.test.ts:130-141` — uma presença, evento `REGISTRATION` e evento `CREATE`; `e2e/leader-access-scopes.spec.ts:169-180` — feedback/lista após reload, `NOT_CONFIRMED` e contagem de presença `1`. | ✅ PASS |
| LEAD-03.3 — fora do fluxo/alteração de Pessoa | Negar cadastro fora da frequência e alteração de cadastro fora do escopo, sem conceder gestão geral de Pessoas. | `src/features/ministerios/access-scope-service.integration.test.ts:186-233` — Líder com grant ativo recebe negação em `promoteToMember` e `inactivatePerson`, preservando status/timeline/auditoria (integração pendente); `e2e/leader-access-scopes.spec.ts:165-177,196-211,218-222` passou com as duas negações, ausência das ações na UI e cadastro genérico negado. | ✅ E2E passou; integração pendente |
| LEAD-03.4 — encontro sem escopo vigente | Negar antes de criar Pessoa, presença, timeline ou auditoria. | `src/features/encontros/quick-visitor-service.integration.test.ts:144-165` — escopo revogado ou outro Ministério rejeita e as quatro contagens/consultas ficam vazias; `:168-175` — conta inativa também não cria Pessoa/presença. | ✅ PASS |
| LEAD-03.5 — falha transacional | Falha após criar Pessoa não deixa Pessoa, presença, timeline ou auditoria órfãs. | `src/features/encontros/quick-visitor-service.integration.test.ts:185-197` — falha de auditoria injetada e as quatro verificações retornam zero/nulo. | ✅ PASS |

**Cobertura independente inicial:** 13/16 critérios cobertos integralmente; os três gaps dessa revisão agora têm assertions escritas. A spec E2E confirmou os novos casos de conta ausente e alteração de status; falta executar as integrações que cobrem os snapshots de regrant. **Lacunas de precisão da especificação:** nenhuma; os resultados esperados são verificáveis.

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

- **E2E funcional Admin/Líder:** a spec estendida passou 1/1 em 2026-09-28 pelo runner `rtk run -c 'PLAYWRIGHT_PORT=3112 npm run test:e2e -- e2e/leader-access-scopes.spec.ts'`, com PostgreSQL temporário em tmpfs (`emaus_e2e_ab75b025c044`), removido pelo runner ao final. Uma tentativa anterior foi interrompida antes da spec para evitar concorrência e não entra como resultado.
- **Build consolidado:** `next build` passou na execução consolidada mais recente em 2026-09-28, conforme coordenador. O build isolado anterior também consta acima como aprovado.
- **Capacidade:** a execução separada de `e2e/capacity.spec.ts` expirou em 180 s no teardown do trace; é resultado de outra suíte, não falha do E2E Admin/Líder.
- **Integrações:** a evidência histórica registra 23 testes aprovados em quatro arquivos. A inspeção contou 24 declarações `it()` antes das novas alterações e 25 agora; o grupo DB-backed não foi reexecutado após as novas assertions. Não afirmar que os 25 passaram. O E2E passou os novos casos de grant para conta ausente e de negação das operações de status.
- **Unitários focados:** `rtk run -c 'npm test -- src/features/pessoas/status-service.test.ts src/server/authorization.test.ts'` passou, 9/9. Os dois novos casos provam que promotion e inactivation negam Leader antes de consultar uma Pessoa.
- **Lint focado atual:** ESLint dos dois testes de serviço e da spec E2E passou, sem warnings.
- **Typecheck atual:** `npm run typecheck` falha somente no import preexistente de `resetAccountPassword` em `src/features/auth/account-service.integration.test.ts:3`; fora das alterações desta frente. O `next build` consolidado anterior é reportado separadamente.

### Sensor de discriminação

| Mutação | Resultado |
|---|---|
| Em worktree descartável, forçar a consulta da lista do Líder a `id: { in: [] }`; executar `rtk run -c 'PLAYWRIGHT_PORT=3114 npm run test:e2e -- e2e/leader-access-scopes.spec.ts'` via runner do projeto. | **Inconclusivo** — o runner criou DB PostgreSQL temporário em tmpfs e passou os 2 guard tests, mas o E2E expirou após 180 s navegando ao encontro sem escopo (`e2e/leader-access-scopes.spec.ts:127`, `page.goto`/`ERR_ABORTED`), antes do grant e da assertion da lista concedida (`:142`). Não classificar como mutant morto nem sobrevivente. Worktree/container foram removidos. Nenhuma conexão ao banco de `.env` foi usada. |

**Profundidade:** 1 mutação leve tentada; 0 mortas, 0 sobreviventes, 1 inconclusiva por timeout anterior à assertion-alvo. Sem nova tentativa conforme coordenação de slots.

### Qualidade e planos de correção

| Verificação | Estado |
|---|---|
| Código usa os helpers existentes de autorização, transação e auditoria; sem abstração ou expansão evidente além do escopo. | ✅ |
| Novas assertions permanecem no escopo da frente: testes de escopo/status, UI E2E do Líder e este relatório. | ✅ |
| Padrões documentados consultados: `AGENTS.md`, `package.json`, `playwright.config.ts` e `.agents/skills/tlc-spec-driven/references/coding-principles.md`. | ✅ |
| Testes por camada cobrem cada critério e edge case sem lacunas. | 🟨 — as 3 lacunas de AC receberam assertions; a E2E passou os casos de conta ausente, timestamps do grant inicial e status do Líder. O snapshot de regrant precisa da suíte de integração. O edge case de múltiplos grants ativos continua sem assertion. |

**Planos de correção sugeridos:**

1. **Integração pendente:** executar em banco descartável o caso de grant para `accountId` inexistente e verificar rejeição/ausência de concessão parcial; o E2E equivalente passou.
2. **Integração pendente:** executar os asserts `createdAt` e snapshots before/after de grant e regrant; o E2E verifica o grant inicial, não o regrant.
3. **Integração pendente:** executar as negações de promoção/inativação com assertions de Pessoa/timeline/auditoria. Os testes unitários passaram e o E2E final verificou as negações e ausência de ações na UI.
4. Em `src/features/ministerios/ministry-service.integration.test.ts`, conceder dois Ministérios ativos à mesma conta e afirmar que ambos são listados, preservando a exclusão do não concedido/arquivado.

## Resumo do Verificador

**Veredito da revisão independente inicial:** ❌ FAIL — havia lacunas de evidência; não foi observada falha funcional nos 13 critérios então cobertos. O reteste E2E e o estado atual estão registrados no fechamento abaixo.

**Critérios:** 13/16 cobertos integralmente; 3 parciais. **Gate:** E2E Admin/Líder 1/1 e build consolidado aprovados; timeout de capacidade separado. **Sensor:** 1 tentativa inconclusiva, sem conclusão de morto/sobrevivente.

**O que funciona:** listagem e detalhe por escopo, estado vazio, bloqueios após revoke, controle Admin, auditoria de ações sem timestamp testado, cadastro contextual e rollback.

**Lacunas:** conta inexistente, timestamp/snapshot de grant na auditoria, operação de alteração de Pessoa por Líder e cenário de múltiplos grants ativos.

**Próximo passo:** executar em base descartável as integrações atualizadas e a spec E2E estendida; depois repetir o sensor em uma execução sem contenção de browser.

## Fechamento das lacunas — 2026-09-28

- LEAD-02.4 agora cobre explicitamente grant para conta inexistente e zero concessões parciais em teste de integração e E2E.
- LEAD-02.5 agora valida `AuditEvent.createdAt` e `grantedAt` nos snapshots de grant e regrant; o teste E2E também confere timestamp e snapshot do grant inicial.
- LEAD-03.3 agora verifica que um Líder com escopo ministerial não pode promover Visitante nem inativar Membro pela camada de serviço, mantendo status/timeline/auditoria intactos; a UI do perfil concedido também não apresenta a seção “Ações de status”.
- O teste unitário focado de status e autorização passou 9/9. A primeira tentativa E2E foi interrompida antes da spec para evitar concorrência; após liberação do runner, a execução completa passou 1/1 no DB tmpfs descartável, cobrindo conta inexistente, snapshot do grant inicial e as duas alterações de status negadas sem persistência.
- As novas assertions E2E foram verificadas. A suíte de integração permanece pendente, em especial o timestamp/snapshot before/after do regrant. O cenário de dois Ministérios ativos continua como edge case sem cobertura.

## Rodada integrada final — 2026-09-28

`e2e/leader-access-scopes.spec.ts` passou dentro da execução serial de sete specs: **31/31 E2E em 3,8 min**, incluindo grant com conta inexistente, timestamp/snapshot do grant inicial, negações de promoção/inativação e ausência de mutação no perfil do Líder. O runner usou o banco PostgreSQL temporário tmpfs `emaus_e2e_fc00faf5c5da` e o removeu ao final.

Depois da rodada, unit-only passou **80/80 em 22 arquivos**, lint passou sem erros (um warning existente de `<img>`), `db:validate`, `git diff --check` e `test:e2e:safety` (2/2) passaram. Typecheck segue bloqueado apenas pelo import ausente `resetAccountPassword` em teste de integração de Contas. As integrações DB-backed adicionadas não foram executadas; não declarar os snapshots de regrant como aprovados. Continua faltando cenário de múltiplos grants ativos. O build de produção passou no estado atual pelo runner temporário com `rtk run -c 'npm run test:capacity -- --list'`; o cenário de capacidade foi apenas listado, não executado, e o banco tmpfs foi removido.
