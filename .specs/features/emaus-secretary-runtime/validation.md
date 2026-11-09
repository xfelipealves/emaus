# Estabilidade dos módulos para Secretaria — validação

**Spec**: `.specs/features/emaus-secretary-runtime/spec.md`  
**Design**: `.specs/features/emaus-secretary-runtime/design.md`  
**Status**: baseline independente inicial apontou 5/8 ACs completos; os gaps receberam testes e foram exercitados na rodada integrada final (31/31 E2E). Lint, schema e unit-only passaram; typecheck segue bloqueado por erro externo em Contas. Não houve execução consolidada de Vitest de integração após o incidente de isolamento.

**Atualização de 2026-09-28**: foram adicionadas asserções para os três gaps independentes e para a navegação após falha de frequência. A rodada integrada final, serial e sem disputa do webServer, passou por toda a suíte relevante; veja o fechamento no fim deste documento.

## Gates da implementação

| Gate | Resultado | Evidência |
| --- | --- | --- |
| RED comportamental do boundary | Observado | A versão provisória falhou nos três testes: expunha exceção, não exercitava o fallback com `reset` isolado e registrava o objeto `Error` sem escopo estruturado. |
| Unitário do boundary | Passou | `rtk npm test -- 'src/app/(dashboard)/error.test.tsx'` — 3/3. |
| Suíte unitária sem integração | Passou | `rtk npm test -- --exclude '**/*.integration.test.ts'` — 11 arquivos, 33 testes. |
| TypeScript antes das mudanças compartilhadas | Passou | `rtk ./node_modules/.bin/tsc --noEmit --incremental false`. O typecheck atual falha em `src/features/auth/account-service.integration.test.ts`, fora desta frente: importa `resetAccountPassword`, que não é exportado. |
| ESLint direcionado | Passou | ESLint dos arquivos do boundary e E2E passou; ESLint direcionado ao E2E também passou após os últimos ajustes. A validação ampla anterior terminou sem erros e com um warning existente de `<img>` em `src/app/(dashboard)/pessoas/[personId]/page.tsx`. |
| Segurança do runner | Passou | `rtk npm run test:e2e:safety` — 2/2. Recusa URL ausente, banco compartilhado e destino remoto. |

## Incidente anterior com alvo incorreto

Em uma tentativa anterior, o preflight validou um alvo `emaus_e2e_secretary`, mas a URL não foi passada ao processo Playwright. O comando usou `rtk env`, que apenas lista variáveis, e executou Playwright diretamente. O Prisma carregou `.env`, informou `emaus` como alvo e concluiu `migrate reset --force` e o seed de demonstração. Um dos cinco testes chegou ao fim; o processo foi interrompido antes dos outros quatro. **Essa execução não é evidência válida.**

Depois de interromper, encerrei somente o servidor iniciado pela execução; 3102 ficou sem listener. Não fiz restauração, consulta nem outra operação no banco `emaus` após o incidente e não registrei URL ou credenciais. O teste válido descrito abaixo usou o runner temporário do projeto e não selecionou esse banco.

## E2E válido pelo runner descartável

Comando executado, serialmente, sem URL fixa:

```sh
rtk run -c 'PLAYWRIGHT_PORT=3102 npm run test:e2e -- e2e/secretary-runtime.spec.ts'
```

O runner criou um PostgreSQL efêmero em tmpfs, executou migrations e seed após as guardas e propagou o alvo apenas aos processos do próprio runner. O Prisma informou o nome do banco temporário `emaus_e2e_0c67e8467267`. Ao concluir, o runner removeu o container. A checagem do listener confirmou a porta `3102` livre.

Resultado: **5 testes passaram em 26 segundos, sem falhas nem skips**.

| Caso | Resultado observado |
| --- | --- |
| Agenda `/encontros` | Secretaria autenticada abriu e recarregou a agenda; título e encontro de demonstração permaneceram visíveis, sem `pageerror`. |
| Detalhe `/encontros/[meetingId]` | Quadro autorizado abriu e recarregou; não houve mutação de presença nem `pageerror`. |
| Leitura `/ministerios` | Página atual de leitura abriu e recarregou; nenhum formulário de gestão ou link de gerenciamento apareceu, sem `pageerror`. |
| Atividades e subtarefa | Estado vazio apareceu. Entrada inválida exibiu alerta e manteve contagem Prisma de atividades em zero. A atividade criada teve contagem exata 1. A ação de criar subtarefa enviou um POST, sua contagem Prisma foi 1, e após reload havia um único `li.subtask-row`; estado concluído também persistiu após novo reload. Sem `pageerror`. O `afterAll` removeu a atividade e a sessão efêmera. |
| Sessão expirada | Cookie expirado redirecionou `/encontros`, detalhe, `/ministerios` e `/atividades` para `/login`, sem `pageerror`. |

Durante o diagnóstico anterior à rodada final, o teste de atividades interagiu antes da hidratação completa. A execução final espera `load`, confirma hidratação do cartão pelo botão de exclusão habilitado e espera o feedback real da ação. A evidência final de um POST, contagem de uma subtarefa e um único `li.subtask-row` mostra que as duas ocorrências observadas antes não eram duas linhas persistidas. Não foi necessária alteração em código de atividades.

## Lacunas restantes

- Build de produção passou em execução consolidada posterior pelo runner isolado. O gate de integração consolidado não foi repetido após o incidente; nenhum comando desta rodada selecionou o banco de desenvolvimento.
- O typecheck atual falha no import de `resetAccountPassword` em arquivo de integração fora dos paths desta frente. O TypeScript direcionado havia passado antes de mudanças compartilhadas no workspace.
- Os cinco fluxos protegidos passaram com fixtures de demonstração. Isso confirma ausência de exceções nesses cenários, sem afirmar que reproduz todas as condições do relato original.
- A leitura atual de `/ministerios` foi validada, mantendo os limites de gestão. Nenhuma decisão de produto sobre política de leitura foi adicionada.

## Diff-check

`git diff --check -- .specs/features/emaus-secretary-runtime/design.md .specs/features/emaus-secretary-runtime/tasks.md .specs/features/emaus-secretary-runtime/validation.md e2e/secretary-runtime.spec.ts` passou sem diagnóstico. Nenhuma mudança foi staged ou commitada nesta frente.

## Gate consolidado — 2026-09-28

- O `next build` consolidado passou usando PostgreSQL temporário em tmpfs; guardas do runner 2/2, container removido.
- Depois do build, o teste separado `e2e/capacity.spec.ts` excedeu 180 s e o teardown do trace expirou; o runner encerrou com falha. Esse timeout é um resultado separado e não altera o build aprovado nem o E2E da Secretaria, que segue 5/5.
- Lint passou sem erros, com um warning existente de `<img>`; `db:validate` e `git diff --check` passaram. Typecheck global segue bloqueado pelo import externo de `resetAccountPassword`; unit-only ficou 51/52 pela falha externa do link de categorias em Encontros.

## Verificação independente — 2026-09-28

**Verificador**: independente do autor da implementação. A revisão ficou limitada aos artefatos desta feature e aos testes externos explicitamente responsáveis por frequência e atividades compartilhadas. Nenhum arquivo de implementação ou teste compartilhado foi alterado.

### Conclusão por critério de aceite

| Critério | Resultado esperado pela spec | `file:line` + asserção e valor | Resultado |
| --- | --- | --- | --- |
| SEC-RUN-01 / P1.1 — abrir `/encontros` | Agenda ou vazio válido, sem exceção de cliente | `e2e/secretary-runtime.spec.ts:38-45` — `Encontros` e `Demo Encontro de Comunidade` visíveis antes/depois do reload; `expect(pageErrors).toEqual([])` | ✅ PASS |
| SEC-RUN-01 / P1.2 — operar encontro autorizado | Exibir frequência e permitir lançamento e correção pela Secretaria | `e2e/secretary-runtime.spec.ts:52-59` — encontro e `Resumo` visíveis após reload; `e2e/attendance.spec.ts:202-212` — Secretaria muda `NOT_CONFIRMED → PRESENT → ABSENT`, verifica feedback e persistência. | ✅ PASS na rodada integrada final |
| SEC-RUN-01 / P1.3 — frequência negada/falha | Erro contextual, página funcional e valor não salvo não marcado como concluído | `e2e/attendance.spec.ts:255-266` — encontro cancelado mantém `Não confirmado`/`NOT_CONFIRMED`, mostra `Encontro cancelado não aceita lançamentos de presença.`, oferece retry e, ao reabrir, salva `PRESENT`. É cobertura da frente de frequência, separada dos 5 E2E da Secretaria. | ✅ PASS |
| SEC-RUN-02 / P1.1 — atividades compartilhadas | Secretaria ativa vê o mesmo item compartilhado que outras contas ativas | `e2e/activities.spec.ts:170-213` — Administrador cria item; Secretaria e depois Líder veem o mesmo título e estado após edição/reload. É teste existente da frente de atividades, separado dos 5 E2E da Secretaria. | ✅ PASS |
| SEC-RUN-02 / P1.2 — criar/editar atividade ou subtarefa | Persistência mais confirmação ou erro contextual conforme ACT-01 a ACT-07 | `e2e/secretary-runtime.spec.ts:93-145` — entrada vazia mostra alerta exato sem registro; criação de atividade/subtask confirma sucesso e contagens; conclusão persiste após reload. `e2e/activities.spec.ts:188-208` — edição da subtask e da área mostra feedback exato, confirma valores no Prisma e após reload. | ✅ PASS nos fluxos exercitados; entradas inválidas de edição continuam sem caso E2E dedicado |
| SEC-RUN-03 / P1.1 — leitura de Ministérios | Página de leitura válida ou negação controlada, nunca exceção de cliente | `e2e/secretary-runtime.spec.ts:66-75` — título e `Demo Acolhimento` visíveis após reload; zero formulários e `pageErrors=[]`. | ✅ PASS |
| SEC-RUN-03 / P1.2 — ação administrativa de Ministério | Negar a ação e não exibir formulários de gestão | `e2e/secretary-runtime.spec.ts:160-203` — chamadas diretas de criar, alterar cargo e encerrar vínculo são rejeitadas; Prisma confirma nenhum vínculo novo, vínculo existente inalterado e zero audit/timeline. A UI continua sem formulários de gestão. | ✅ PASS na rodada integrada final |
| SEC-RUN-04 / P1.3 — sessão/dados inválidos em rota protegida | Estado seguro e diagnóstico técnico suficiente | `src/app/(dashboard)/error.test.tsx:23-31` — alerta/cópia/retry exatos e sentinel privado ausente; `:43-53` — log esperado contém `scope: "dashboard"` e `digest: "next-digest-42"`, sem mensagem privada. `e2e/secretary-runtime.spec.ts:150-182` — sessão expirada redireciona as quatro rotas para `/login`, sem `pageerror`. | ✅ PASS |

**Cobertura no baseline independente**: 5/8 critérios correspondiam a asserções com o resultado da spec; 3/8 eram parciais. A rodada integrada final executou os novos casos E2E documentados abaixo. Nenhum critério foi tratado como coberto apenas por existência de código.

### Tarefas e casos de borda

- T1 e T2 permanecem marcadas como concluídas em `tasks.md`; a evidência correspondente está nas seções anteriores e nos testes citados acima.
- Sessão expirada, lista de atividades vazia e encontro cancelado têm estados explícitos cobertos pelos testes citados.
- A navegação após falha de ação de frequência está coberta em `e2e/secretary-runtime.spec.ts:79-142`; não cobre falha de renderização de segmento.
- A matriz de contagem de testes antes/depois da feature não está no histórico disponível; não foi possível calcular o delta de testes.

### Gates e sensor de discriminação

- **Unit baseline**: `rtk npm test -- 'src/app/(dashboard)/error.test.tsx'` — 3/3 passaram nesta verificação.
- **E2E baseline da Secretaria**: 5/5 em 26 s no runner descartável, conforme o registro anterior; não foi repetido sem mutação nesta verificação.
- **Build**: `next build` consolidado passou conforme o gate desta data. O timeout posterior de 180 s em `e2e/capacity.spec.ts` é uma execução independente, não uma falha do build nem do E2E 5/5 da Secretaria.
- **Typecheck/integração**: o typecheck global segue falhando no import externo de `resetAccountPassword`; os testes de integração consolidados não foram repetidos após o incidente do banco. Nenhum acesso direto ao banco padrão foi feito.

| Mutação em cópia descartável | Asserção que detectou | Resultado |
| --- | --- | --- |
| Omitir `createSubtask` em `src/app/(dashboard)/atividades/actions.ts:88` | `e2e/secretary-runtime.spec.ts:122` — contagem esperada 1, obtida 0; o caso de atividade falhou. Os outros três casos anteriores passaram e o último não rodou por configuração serial. O runner criou e removeu um PostgreSQL temporário em tmpfs. | ✅ Morta |
| Trocar `onClick={reset}` por callback vazio em `src/app/(dashboard)/error.tsx:21` | `src/app/(dashboard)/error.test.tsx:40` — `expect(retryButton?.props.onClick).toBe(reset)` falhou. | ✅ Morta |

**Sensor leve**: 2/2 mutações mortas; nenhuma sobreviveu. As mutações ocorreram somente em worktree temporária descartável; o `e2e/secretary-runtime.spec.ts` copiado para ela continha a versão atual da working tree. O runner isolado recebeu somente a URL descartável que ele próprio criou e removeu.

### Lacunas priorizadas

1. **SEC-RUN-01 / P1.2** — acrescentar asserção de que Secretaria também corrige frequência, não apenas lança o primeiro estado; validar o valor persistido após a correção.
2. **SEC-RUN-02 / P1.2** — especificar quais confirmações/erros são exigidos para cada edição ACT e cobrir edição da atividade/subtarefa com a mensagem correspondente, além da persistência já testada.
3. **SEC-RUN-03 / P1.2** — testar tentativa direta de chamar ações administrativas como Secretaria e confirmar ausência de mutação, além de ocultar formulários e negar a rota de vínculos.
4. **Borda de navegação** — comprovar que erro em uma rota protegida não impede abrir outra rota depois.

**Veredito independente inicial**: ❌ **FAIL** — naquela revisão havia três lacunas de critério e uma borda sem asserção. As correções e a execução posterior constam abaixo; o timeout de capacidade é separado.

### Correções de cobertura posteriores ao baseline independente

| Critério / borda | Asserções adicionadas | Estado |
| --- | --- | --- |
| SEC-RUN-01 / P1.2 — correção de frequência pela Secretaria | `e2e/attendance.spec.ts:202-212` — a Secretaria muda `NOT_CONFIRMED → PRESENT → ABSENT`; `Presença salva.` e o estado `ABSENT` persistido são verificados após a correção. | Implementado; incluído na rodada integrada final |
| SEC-RUN-02 / P1.2 — feedback e estado persistido da edição compartilhada | `e2e/activities.spec.ts:187-208` — confirmações exatas `Subtask atualizada.` e `Área atualizada.`; Prisma confirma subtask concluída e bucket `PARKED`. | Implementado; incluído na rodada integrada final |
| SEC-RUN-03 / P1.2 — tentativa direta de ação administrativa | `e2e/secretary-runtime.spec.ts:160-203` — chamadas diretas de Secretaria a `createMembership`, `updateMembershipRole` e `endMembership` são rejeitadas; Prisma confirma ausência de vínculo novo, vínculo pré-existente inalterado e zero eventos de auditoria/timeline. | Implementado; incluído na rodada integrada final |
| Borda — navegar após erro de frequência | `e2e/secretary-runtime.spec.ts:79-142` — após falha contextual por encontro cancelado, a Secretaria abre `/ministerios`, retorna ao encontro e tenta novamente; o registro final fica `PRESENT`. Esta asserção cobre falha de ação e navegação, não uma exceção de renderização do segmento. | Implementado; incluído na rodada integrada final |

### Validação das novas asserções

- `rtk npx eslint e2e/attendance.spec.ts e2e/activities.spec.ts e2e/secretary-runtime.spec.ts` — passou sem issues.
- `rtk run -c 'PLAYWRIGHT_PORT=3110 npm run test:e2e -- e2e/secretary-runtime.spec.ts e2e/attendance.spec.ts e2e/activities.spec.ts'` — **interrompido antes da conclusão, 6 de 18 testes**. Durante uma disputa concorrente de inicialização do webServer, o servidor reportou `PageNotFoundError` para `/(dashboard)/encontros/[meetingId]/page`; a rodada não serve como validação nem como reprovação dos novos testes. O runner usou somente `emaus_e2e_5ed405153ede` em PostgreSQL temporário; esse container foi removido.
- `rtk npm run typecheck` — bloqueado por diagnósticos das frentes de Encontros/Contas: imports ausentes `category-forms` e `series-forms`, export ausente `resetAccountPassword`, além de tipos `MeetingSeries.audiences` ausentes no Prisma Client atual. Nenhum diagnóstico aponta para os três E2Es desta frente. Esses erros ficam sob avaliação das frentes correspondentes e não são registrados como defeitos da Secretaria.
- `rtk npm test -- 'src/app/(dashboard)/error.test.tsx'` — passou, 3/3; confirma o boundary existente, sem validar as novas asserções E2E. As integrações com banco não foram reexecutadas nesta rodada.

**Status após esta atualização**: os quatro itens da tabela acima foram executados com sucesso na rodada integrada final. O veredito independente 5/8 permanece como registro histórico daquela revisão; a cobertura E2E atual exercita os três ACs e a borda adicionados. O sensor independente não foi repetido.

## Rodada integrada final — 2026-09-28

`rtk run -c 'PLAYWRIGHT_PORT=3105 npm run test:e2e -- e2e/attendance.spec.ts e2e/activities.spec.ts e2e/secretary-runtime.spec.ts e2e/leader-access-scopes.spec.ts e2e/ministry-memberships.spec.ts e2e/people-profile.spec.ts e2e/people.spec.ts'` terminou com **31/31 testes aprovados em 3,8 min**. O runner criou `emaus_e2e_fc00faf5c5da` em PostgreSQL temporário tmpfs, aplicou oito migrations e seed, e removeu o container ao final. A suíte da Secretaria passou nos sete casos, incluindo correção após falha, edição compartilhada, chamadas de gestão negadas sem gravação e sessão expirada.

Verificações executadas depois da rodada: `rtk npm run lint` passou sem erros (um warning existente de `<img>`); `rtk npm run db:validate` passou; unit-only passou **80/80 em 22 arquivos**; `rtk git diff --check` passou; `rtk npm run test:e2e:safety` passou 2/2. `rtk npm run typecheck` permanece bloqueado exclusivamente por `resetAccountPassword` não exportado em `src/features/auth/account-service.integration.test.ts`, fora desta frente. O build atual passou pelo runner temporário usando `rtk run -c 'npm run test:capacity -- --list'`; o runner construiu o app e listou o cenário de capacidade, sem executá-lo, e removeu o banco tmpfs. Não foram executadas integrações Vitest DB-backed neste fechamento.
