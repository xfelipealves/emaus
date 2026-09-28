# Ciclo de vida e histórico de Pessoas — tarefas

## Protocolo de execução

Implementar com `tlc-spec-driven`: um slice por vez, testes derivados dos ACs e gates abaixo. A coordenação desta rodada proíbe `git add`/commit enquanto os workers atuam no mesmo índice; os paths e evidências serão entregues para revisão e commits serializados.

**Design**: `.specs/features/emaus-person-lifecycle/design.md`  
**Status**: In Progress

**Execução nesta rodada**: unit/integration (25 testes no banco descartável), lint dos paths da feature e validação Prisma concluídos. A suíte E2E foi ampliada, mas está pausada até a coordenação corrigir o isolamento do `globalSetup`; E2E e build completo permanecem pendentes. O typecheck do workspace tem uma falha registrada em arquivo reservado à frente de frequência.

## Test Coverage Matrix

> Gerada a partir do spec, `package.json`, `vitest.config.ts`, `playwright.config.ts` e dos testes existentes. Diretrizes encontradas: `AGENTS.md` fornecido na tarefa, configurações Vitest/Playwright e scripts npm; não há guia independente de testes no README/docs. Sem requisito de cobertura numérica, aplicam-se os ACs e casos de borda do spec.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Serviço e consulta de Pessoas | Integration | Visitante sem dados obrigatórios e evento de cadastro; idade ausente permanece nula; filtros de status/lista e perfil existente. | `src/features/pessoas/{person-service,person-query}.integration.test.ts` | `npm run test -- src/features/pessoas/person-service.integration.test.ts src/features/pessoas/person-query.integration.test.ts` |
| Serviço de domínio de status | Unit + integration | Validação de telefone/nascimento; persistência de status, telefone, nascimento e data; histórico/auditoria; falha transacional; conservação dos dados. Mapear ACs de PERS-02/03 e casos de borda diretamente. | `src/features/pessoas/status-service.{test,integration.test}.ts` | `npm run test -- src/features/pessoas/status-service.test.ts src/features/pessoas/status-service.integration.test.ts` |
| Query/serviço de timeline | Integration | Pessoa correta, ordem decrescente, cada filtro e negação sem escopo; filtro Status contém cadastro e status. Nota arquivada some da lista padrão e mantém versões/autoria. | `src/features/timeline/{timeline-query,note-service}.integration.test.ts` | `npm run test -- src/features/timeline/timeline-query.integration.test.ts src/features/timeline/note-service.integration.test.ts` |
| Formulários e rotas de perfil/timeline | E2E | Cada fluxo alterado: sucesso, campos obrigatórios/data editada, perfil e relações após reload, navegação pela aba, filtro, acesso sem escopo e notas arquivadas. | `e2e/people.spec.ts`, `e2e/people-profile.spec.ts` | `PLAYWRIGHT_PORT=3103 npm run test:e2e -- e2e/people.spec.ts e2e/people-profile.spec.ts` |
| Schema/configuração | Build gate | Sem mudança de schema prevista; validar Prisma, tipos, lint e build. | `prisma/schema.prisma`, configs do projeto | `npm run db:validate`; `npm run typecheck`; `npm run lint`; `npm run build` |

Os gates E2E só podem rodar quando `DATABASE_URL` apontar para a base descartável exclusiva `emaus_e2e_people` já validada. O `global-setup` executa `prisma migrate reset --force`; não rodar contra o valor de `DATABASE_URL` já presente no ambiente. Usar `PLAYWRIGHT_PORT=3103`.

## Gate Check Commands

> Comandos extraídos de `package.json`, `vitest.config.ts` e `playwright.config.ts`.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Teste unitário isolado de serviço | `npm run test -- src/features/pessoas/status-service.test.ts` |
| Full | Slice com integração e E2E | `npm run test -- src/features/pessoas/person-service.integration.test.ts src/features/pessoas/person-query.integration.test.ts src/features/pessoas/status-service.test.ts src/features/pessoas/status-service.integration.test.ts src/features/timeline/timeline-query.integration.test.ts src/features/timeline/note-service.integration.test.ts` e `PLAYWRIGHT_PORT=3103 npm run test:e2e -- e2e/people.spec.ts e2e/people-profile.spec.ts` |
| Build | Fechamento da fase final | `npm run db:validate`; `npm run typecheck`; `npm run lint`; `npm run test`; `PLAYWRIGHT_PORT=3103 npm run test:e2e -- e2e/people.spec.ts e2e/people-profile.spec.ts`; `npm run build` |

Nas gates Full/Build, os testes de integração e E2E recebem a configuração da base descartável `emaus_e2e_people`; o alvo não fica registrado no arquivo nem nos logs.

## Plano de execução

As fases executam em ordem. T1 fecha ciclo de status; T2 fecha consulta e navegação histórica.

```text
Phase 1: T1
Phase 2: T1 ──→ T2
```

### T1: Fechar promoção e preservação na inativação

**What**: Iniciar promoção no dia local atual, manter edição da data e comprovar validação e preservação transacional/histórica na promoção e na inativação.

**Where**:

- `src/app/(dashboard)/pessoas/[personId]/status-actions.tsx`
- `src/features/pessoas/status-service.test.ts`
- `src/features/pessoas/status-service.integration.test.ts`
- `e2e/people.spec.ts`

**Depends on**: None  
**Reuses**: `BRAZIL_TIME_ZONE`, `parseDateInput`, transação de `status-service`, fixtures e formulários E2E existentes.  
**Requirement**: PERS-01, PERS-02, PERS-03, PERS-05.

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Formulário de promoção apresenta o dia de hoje em `America/Sao_Paulo` ao abrir e aceita edição.
- [x] Testes de domínio verificam campo telefone/nascimento ausente com mensagens específicas e data de nascimento normalizada.
- [x] Integração comprova promoção com telefone/nascimento e data efetiva escolhida, com evento/auditoria coerentes.
- [x] Integração comprova que ausência de cada campo preserva status, dados anteriores e eventos existentes.
- [x] Integração comprova rollback de status/evento quando a gravação transacional falha.
- [ ] E2E cadastra visitante sem telefone/nascimento, verifica o padrão local e edição da data, bloqueia cada campo ausente, promove com data editada e confere o dia exibido após reload.
- [ ] E2E cria nota antes de inativar com data editada e, após reload, confirma status/data, perfil, vínculo, presença, nota/autoria/versão e histórico preservados.
- [x] Nenhum teste foi removido/ignorado; teste count não diminui.
- [ ] Full gate passa com Vitest do slice e E2E da lifecycle route usando a base descartável exclusiva.

**Tests**: unit, integration, E2E, co-localizados nos quatro paths acima.  
**Gate**: full.

### T2: Completar filtro e acesso da timeline

**What**: Fazer `Status` consultar eventos de cadastro/status, rotular a combinação e provar navegação da aba, filtros e autorização direta.

**Where**:

- `src/features/timeline/timeline-query.ts`
- `src/app/(dashboard)/pessoas/[personId]/timeline/page.tsx`
- `src/features/timeline/timeline-query.integration.test.ts`
- `e2e/people-profile.spec.ts`

**Depends on**: T1.  
**Reuses**: Sessão/escopo em `getPersonProfile`, `getPersonTimeline`, links e filtro de notas arquivadas existentes.  
**Requirement**: PERS-04, PERS-05.

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Query devolve cadastro e mudanças de status no filtro `status`, além de manter as categorias restantes isoladas.
- [ ] Ordem decrescente e filtros de ministérios, frequência, notas e correções continuam cobertos.
- [ ] E2E abre perfil, ativa a aba Timeline e chega à rota da mesma Pessoa; filtro `Status e cadastro` mostra os dois eventos relevantes.
- [ ] E2E de usuário fora do escopo tenta a rota direta e recebe acesso negado sem título, evento ou conteúdo de nota.
- [ ] E2E de nota arquivada comprova que filtro padrão a oculta e `Arquivadas` a revela com autoria e versões preservadas.
- [x] Todos os critérios e casos de borda do spec têm `file:line` e asserção correspondente; os testes novos mapeiam apenas para PERS-01–05.
- [ ] Gate Build passa e não há redução na quantidade de testes.

**Tests**: integration e E2E, co-localizados nos quatro paths acima.  
**Gate**: build.

**Pendência de execução**: cenários de formulário, navegação, filtros pela interface, autorização direta, arquivo de nota e build aguardam a janela serial. As assertions foram preservadas/adicionadas em `e2e/people.spec.ts` e `e2e/people-profile.spec.ts`; a escrita do teste não é tratada como resultado de execução.

## Validação da decomposição

### Granularidade

| Tarefa | Entrega | Resultado |
|---|---|---|
| T1 | Slice de promoção/inativação e prova de preservação | ✅ Uma jornada de domínio com UI, serviço e teste E2E no mesmo gate. |
| T2 | Slice de consulta/navegação de timeline e prova de escopo | ✅ Uma jornada de consulta com query, rota e browser no mesmo gate. |

### Cross-check de dependências

| Tarefa | Depends on | Diagrama | Resultado |
|---|---|---|---|
| T1 | None | Sem predecessor | ✅ |
| T2 | T1 | `T1 → T2` | ✅ |

### Co-localização de testes

| Tarefa | Camadas tocadas | Matriz requer | Campo Tests | Resultado |
|---|---|---|---|---|
| T1 | Formulário, serviço de status, E2E | Unit + integration + E2E | unit, integration, E2E | ✅ |
| T2 | Query, rota, E2E | Integration + E2E | integration, E2E | ✅ |

## Mapa de execução

```text
Phase 1 ──→ Phase 2
T1          T2
```
