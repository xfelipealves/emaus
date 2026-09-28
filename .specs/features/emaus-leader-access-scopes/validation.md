# Validação — Escopo ministerial de Líderes

**Data:** 27/09/2026  
**Branch observada:** `dev`  
**Banco de teste:** `emaus_e2e_leader_scopes` (isolado; nenhum teste desta frente apontou para o banco de desenvolvimento)  
**Status:** Integrações e E2E aprovados; build e suíte integral pendentes.

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
| E2E Admin/Líder | `e2e/leader-access-scopes.spec.ts`: 1 teste passou em Chromium (59,1s totais), porta `3104`, DB dedicado. O processo Playwright encerrou o servidor; porta ficou livre. |
| Build e suíte integral | Pendentes; executar com `DATABASE_URL` apontando ao mesmo DB isolado e sem disputar `.next` com outro browser. |

## Critérios de aceite

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
