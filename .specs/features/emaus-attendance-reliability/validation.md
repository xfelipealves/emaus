# Validação — frequência confiável e auditável

**Data:** 2026-09-27  
**Escopo:** T1–T5 desta frente; teste E2E completo de `e2e/attendance.spec.ts`.  
**Spec:** `spec.md` · **Design:** `design.md` · **Plano:** `tasks.md`

## Ambiente e segurança do teste

- Os testes de banco e o `globalSetup` do Playwright usaram o banco descartável `emaus_attendance_worker1_e2e_20260927`. Antes de cada operação destrutiva, a identidade consultada foi: `current_database=emaus_attendance_worker1_e2e_20260927`, `current_user=emaus`, porta de servidor `5432`; conexão local mapeada para `localhost:5433`.
- A URL foi derivada em memória da configuração local, conferindo que a origem era o banco de desenvolvimento `/emaus` no host/porta esperados antes de substituir somente o nome do banco. O valor da URL, credenciais e linhas de seed foram omitidos dos logs e desta documentação.
- `npm run test:e2e` chama `prisma migrate reset --force`. Os resets registrados nesta validação apontaram somente para o banco descartável confirmado acima; nenhum reset foi executado contra o banco de desenvolvimento.
- O E2E usou `PLAYWRIGHT_PORT=3101`, um worker e Chromium headless. O diretório global `test-results/` é artefato local, fora desta spec.

## Evidência RED → GREEN por tarefa

| Tarefa | RED observado antes da implementação | GREEN após a implementação |
|---|---|---|
| T2 — compare-and-set transacional | Em checkout temporário com apenas o teste de integração novo e sem o código T2, 4 assertions falharam nas regras ausentes: retorno `{ status, changed }`, retry com estado esperado antigo, concorrência com mesmo estado esperado e correção histórica após arquivamento. Dez assertions existentes passaram. | Gate Quick do serviço: 13 testes passaram, nenhum falhou ou foi ignorado; 9 casos de baseline mais 4 casos novos. Na suíte integral atual, `attendance-service.integration.test.ts` passou 10/10 e as unidades relacionadas passaram 3/3. |
| T3 — UI e ação resilientes | Em checkout temporário somente com os dois E2E novos e sem a implementação T3, os dois testes direcionados falharam: a UI não revertia após rejeição de transporte e uma ação duplicada produzia duas entradas de auditoria. | `e2e/attendance.spec.ts` passou 7/7 no banco descartável, incluindo reversão/retry, lock síncrono da mesma linha, disponibilidade de outra linha e perfis Admin, Secretaria e Líder dentro/fora do escopo. |
| T4 — contexto de auditoria em lote | Os testes de integração foram executados antes da query: 2 das 4 assertions falharam exatamente porque eventos `Attendance` não carregavam pessoa/encontro. Os outros contratos já existentes passaram. | `audit-query.integration.test.ts` passou 4/4; a suíte Vitest integral passou 154/154. A query busca os alvos em lote, preserva alvo sem relação com contexto nulo e não adiciona contexto a outras entidades. |
| T5 — apresentação na auditoria/timeline | Antes da UI, o E2E falhou por ausência do texto de Pessoa/Encontro no artigo de auditoria. | O artigo apresenta pessoa, encontro, ator, horário, antes/depois e motivo; a timeline filtrada apresenta o encontro e `ABSENT → NOT_CONFIRMED`. E2E final da frente: 7/7. |

Os REDs de T2/T3 foram reproduzidos no checkout temporário de teste-only solicitado durante a rodada; não se afirma que a implementação principal foi escrita cronologicamente após esses REDs. T4 e T5 tiveram RED antes das alterações correspondentes.

## Cobertura dos critérios de aceite

| Critério | Evidência | Resultado |
|---|---|---|
| FREQ-01 AC1 — inicialização idempotente e estado após reabertura | Integração `attendance-service.integration.test.ts`, caso “initializes selected-ministry eligibility and is idempotent when reopened”; E2E abre, percorre e recarrega em `attendance.spec.ts:19–27`. | Atendido |
| FREQ-01 AC2 — ciclo de três estados e confirmação persistida | Serviço `attendance-service.integration.test.ts:52–60`; E2E `attendance.spec.ts:21–27, 39–44, 59–64`. | Atendido |
| FREQ-01 AC3 — mesma presença não salta estado em chamadas concorrentes/cliques rápidos | Integração `attendance-service.integration.test.ts:82–96`; E2E `attendance.spec.ts:132–168` prova bloqueio da primeira linha, operação independente da segunda e um evento por linha. | Atendido |
| FREQ-01 AC4 — falha sem sucesso falso, gravação parcial ou estado local divergente | Integração transacional `attendance-service.integration.test.ts:99–111`; E2E com POST abortado `attendance.spec.ts:83–116` verifica estado anterior, mensagem de erro, retry e persistência posterior. | Atendido |
| FREQ-01 AC5 — retry/reconciliação no máximo uma vez | Integração com estado esperado obsoleto `attendance-service.integration.test.ts:71–79`; retry real de rede em `attendance.spec.ts:107–116`. | Atendido |
| FREQ-02 AC1 — ator, horário, alvo, antes/depois e motivo opcional | Persistência `attendance-service.integration.test.ts:52–68`; E2E da auditoria `attendance.spec.ts:29–37, 45–57`. | Atendido |
| FREQ-02 AC3 / FREQ-04 — identificar Pessoa e Encontro na auditoria | Query `audit-query.integration.test.ts:118–139`; apresentação E2E `attendance.spec.ts:29–37, 52–57`. Eventos sem alvo mantêm ID/tipo e contexto nulo; outras entidades mantêm o formato anterior. | Atendido |
| FREQ-03 — evento da timeline ligado à Pessoa, encontro e transição | Integração `attendance-service.integration.test.ts:67–68`; E2E da timeline filtrada `attendance.spec.ts:63–67`. | Atendido |
| FREQ-02 AC4 / FREQ-05 — autorização por escopo | Integração `attendance-service.integration.test.ts:114–120`; E2E Secretaria e Líder escopado operam, e Líder sem acesso não vê o quadro em `attendance.spec.ts:184–237`. | Atendido |
| FREQ-02 AC5 / FREQ-05 — cancelamento e arquivamento | Integração `attendance-service.integration.test.ts:123–160`; E2E de cancelamento e histórico arquivado em `attendance.spec.ts:239–323`. | Atendido |

## Gates executados

| Gate | Resultado |
|---|---|
| `npm run build` | Exit code 0; compilação e geração de páginas estáticas concluídas. Aviso existente de `<img>` em `src/app/(dashboard)/pessoas/[personId]/page.tsx:59`. |
| `npm run lint` | Exit code 0; zero erros e o mesmo aviso existente de `<img>`. |
| `npm run typecheck` | `tsc --noEmit`, exit code 0. |
| `DATABASE_URL=<banco descartável> npx prisma migrate deploy` | Exit code 0; nenhuma migration pendente. |
| `DATABASE_URL=<banco descartável> npm test` | 33 arquivos e 154 testes passaram; 0 falhas. Inclui `attendance-service.integration.test.ts` 10/10, `audit-query.integration.test.ts` 4/4 e `quick-visitor-service.integration.test.ts` 5/5. |
| `DATABASE_URL=<banco descartável> PLAYWRIGHT_PORT=3101 npm run test:e2e -- e2e/attendance.spec.ts` | Exit code 0; 7/7 passaram em 1,1 minuto. |
| `git diff --check` nos paths desta frente | Exit code 0. |

## Tentativas intermediárias e diagnóstico

- A primeira tentativa de webServer expirou durante inicialização fria. Sem aumentar timeout ou editar configuração global, `next dev --port 3101` foi iniciado manualmente com a URL candidata validada e respondeu `200` em `/login`. Nas tentativas seriais seguintes, Next iniciou e Playwright alcançou os testes; o log mostrou avisos de múltiplos lockfiles, origem de asset de desenvolvimento e depreciações, sem erro fatal de compilação. A causa específica do primeiro timeout não foi reproduzida; cold start permanece uma hipótese, não uma conclusão.
- Duas tentativas E2E intermediárias tiveram assertions de teste, não falha de dados da funcionalidade: o texto JSON da auditoria estava formatado em `<pre>` e o matcher buscava um trecho sem a estrutura/whitespace; depois, a navegação da timeline esperava `load` por 30s embora o snapshot já mostrasse o conteúdo completo. Os asserts agora verificam antes/depois por `<pre>` na ordem correta e a navegação espera `domcontentloaded` mantendo asserts de conteúdo.
- Um locator do visitante rápido excedeu o timeout padrão de 5s; o snapshot capturado após a falha já mostrava “Visitante adicionado.”, a linha `Não confirmado` e o resumo 2/0/0. O teste agora espera o POST, feedback e linha com limite local de 10s. A limpeza já excluía Attendance antes do encontro; esperar a resposta antes da limpeza remove a corrida de teardown.
- Uma execução adicional após o reset do banco isolado não conseguiu lançar nenhum dos sete casos porque o cache de Chromium estava ausente. Não houve teste de browser nessa tentativa. A coordenação restaurou o `headless_shell` e confirmou a versão; a execução final passou 7/7.
- Não foi executado `npm run test:e2e` global sem filtro: a rodada era paralela e as demais specs pertenciam a outras frentes. O gate E2E desta feature rodou integralmente seus sete casos; o E2E global fica para a coordenação final do workspace.

## Gate consolidado — 2026-09-28

- `npm run build` passou (compilação, checagem de tipos do Next e geração das páginas) usando PostgreSQL temporário em tmpfs; as guardas passaram 2/2 e o container foi removido.
- O teste separado de capacidade `e2e/capacity.spec.ts` excedeu o timeout de 180 s e o teardown do trace expirou. O runner encerrou com falha e removeu o container. O E2E funcional desta frente segue 7/7.
- Lint passou sem erros, com um warning existente de `<img>`; `db:validate` e `git diff --check` passaram. No typecheck global, segue o import externo de `resetAccountPassword`; no unit-only, 51/52 passaram, com falha externa no link de categorias de Encontros.

## Verificação independente — 2026-09-28

**Veredito do escopo da frequência:** PASS — 10/10 critérios com assertion rastreável; nenhum gap de precisão da spec. A revisão cobriu os arquivos de implementação/teste indicados em `tasks.md`. O código de frequência está no `HEAD` `37b11a6`; não havia diff local nos arquivos de frequência, testes ou E2E. Apenas este relatório foi atualizado nesta passada.

### Critérios ancorados na spec

| Critério | Resultado esperado | `file:line` + assertion/value | Resultado |
|---|---|---|---|
| Lançamento AC1 — elegíveis começam não confirmados e reabrir não duplica | `NOT_CONFIRMED`; uma linha preserva o estado existente | `src/features/encontros/attendance-service.integration.test.ts:166-173` — `toHaveLength(1)`, status `NOT_CONFIRMED`, reabertura `PRESENT`, `attendance.count === 1`; `e2e/attendance.spec.ts:19-27` — linha inicia `Não confirmado`, DB fica `PRESENT` e reload mostra `Presente` | ✅ PASS |
| Lançamento AC2 — ciclo e resposta confirmada | `NOT_CONFIRMED → PRESENT → ABSENT → NOT_CONFIRMED`; tela/DB refletem resposta persistida | `src/features/encontros/attendance-service.cycle.test.ts:5-8` — três transições exatas; `src/features/encontros/attendance-service.integration.test.ts:55-60` — cada chamada retorna o status seguinte e `changed: true`; `e2e/attendance.spec.ts:21-27, 39-44, 59-64` — rótulos e status lidos do DB | ✅ PASS |
| Lançamento AC3 — bloquear transição concorrente na mesma linha | Uma única transição para o estado esperado; a mesma linha fica pendente/desabilitada | `src/features/encontros/attendance-service.integration.test.ts:86-96` — duas chamadas resultam em `PRESENT`, uma `changed`, auditoria/timeline contam 1; `e2e/attendance.spec.ts:148-168` — dois cliques, linha 1 `disabled`, linha 2 `enabled`, cada linha persiste `PRESENT` e gera um evento | ✅ PASS |
| Lançamento AC4 — erro restaura o estado e oferece nova tentativa | Falha não salva presença; estado anterior e mensagem de erro ficam visíveis; retry pode salvar | `src/features/encontros/attendance-service.integration.test.ts:105-108` — chamada rejeita, status fica `NOT_CONFIRMED`, auditoria/timeline contam 0; `e2e/attendance.spec.ts:98-116` — POST abortado, linha/DB continuam `NOT_CONFIRMED`, erro e botão `Tentar novamente`, depois DB fica `PRESENT` | ✅ PASS |
| Lançamento AC5 — retry/reconciliação no máximo uma vez | Estado obsoleto retorna o status persistido com `changed: false`; evento não duplica | `src/features/encontros/attendance-service.integration.test.ts:75-79` — segunda chamada com `NOT_CONFIRMED` retorna `{ status: "PRESENT", changed: false }`, DB `PRESENT`, audit/timeline `1`; `e2e/attendance.spec.ts:113-116` — retry de rede termina com rótulo/salvamento `Presente` e DB `PRESENT` | ✅ PASS |
| Histórico AC1 — auditoria registra ator, horário, alvo, antes/depois e motivo opcional | `Attendance`/ID e ator corretos; `PRESENT → ABSENT`; motivo informado ou `null`; timestamp Date | `src/features/encontros/attendance-service.integration.test.ts:62-66` — `actorId`, `targetType`, `targetId`, `before`, `after`, motivo e `createdAt instanceof Date`; `e2e/attendance.spec.ts:29-37, 45-57` — auditor, `<time datetime>`, alvo Pessoa/Encontro e payloads exatos | ✅ PASS |
| Histórico AC2 — timeline da Pessoa | Evento `ATTENDANCE` pertence à Pessoa e identifica Encontro/transição | `src/features/encontros/attendance-service.integration.test.ts:67-68` — `personId`, título `Presença atualizada` e descrição exata `Ministério …: PRESENT → ABSENT`; `e2e/attendance.spec.ts:61-67` — timeline mostra `${meeting.title}: ABSENT → NOT_CONFIRMED` | ✅ PASS |
| Histórico AC3 — auditoria permite reconhecer Pessoa/Encontro e antes/depois | Contexto de alvo exato e estados anteriores/novos exatos | `src/features/auditoria/audit-query.integration.test.ts:118-132` — pessoa, título do encontro, `NOT_CONFIRMED` e `PRESENT`; `e2e/attendance.spec.ts:31-37, 52-57` — artigo identifica Pessoa/Encontro e apresenta payloads antes/depois | ✅ PASS |
| Histórico AC4 — fora do escopo não lista/altera nem expõe o quadro | Listagem e alteração negadas, sem mudar a linha; quadro sem Pessoa para Líder fora do escopo | `src/features/encontros/attendance-service.integration.test.ts:114-120` — rejeições `Encontro não encontrado.`/`Presença não encontrada.`, estado `NOT_CONFIRMED`; `e2e/attendance.spec.ts:184-221` — Secretaria e Líder escopado persistem mudanças, Líder externo é redirecionado, Pessoa não aparece e estado continua `ABSENT` | ✅ PASS |
| Histórico AC5 — cancelado/Ministério arquivado bloqueia novos lançamentos e mantém histórico | Rejeitar mudanças/adições; manter presença histórica consultável | `src/features/encontros/attendance-service.integration.test.ts:132-160` — cancelado não inicializa (contagem 0), arquivado rejeita lançamento em `NOT_CONFIRMED`, histórico `PRESENT` reabre e correção `ABSENT` preserva uma linha; `src/features/encontros/attendance-query.integration.test.ts:105-117` — busca/adição manual/visitante rejeitados para Ministério arquivado; `e2e/attendance.spec.ts:239-266, 282-309` — cancelamento reverte e permite retry após reabertura; histórico arquivado recarrega e permanece corrigível | ✅ PASS |

### Discrimination sensor

| Mutação no scratch | Sensor | Resultado |
|---|---|---|
| `src/features/encontros/attendance-service.ts:27` no worktree temporário: retorno da transição de `PRESENT` alterado de `ABSENT` para `NOT_CONFIRMED` | O runner `npm run test:e2e` criou DB PostgreSQL descartável em tmpfs; somente `cycles an eligible person's attendance` foi executado. A assertion `e2e/attendance.spec.ts:45-50` esperava auditoria `PRESENT → ABSENT` e recebeu `PRESENT → NOT_CONFIRMED`. | ✅ Mutante morto (1/1). Container e worktree temporários removidos. A tentativa inicial com timeout padrão expirou durante cold start; a repetição com limite de 90s chegou à assertion e matou o mutante. Nenhum teste foi alterado e a árvore compartilhada não foi modificada. |

### Cobertura de bordas e qualidade

- Elegibilidade por audiência e deduplicação: `src/features/encontros/attendance-service.test.ts:12-18` espera `person-a/person-b` para `ministry-b` e uma ocorrência de cada pessoa; adição manual de Pessoa/visitante está coberta em `e2e/attendance.spec.ts:325-347`.
- Falha de rede, ações rápidas, cancelamento, arquivo e leitura do histórico estão cobertos pelas evidências acima. Os E2Es criam entidades com sufixo único e limpam registros no `finally` (`e2e/attendance.spec.ts:8-14, 68-80`); a execução do sensor usou somente o runner seguro do projeto.
- Princípios revisados conforme `.agents/skills/tlc-spec-driven/references/coding-principles.md`: alterações focadas e alinhadas às tarefas, sem sinal de teste enfraquecido; cada teste listado mapeia AC/caso de borda; cobertura de serviço e UI inclui sucesso, erro e autorização. Guidelines consultadas: `README.md`, `vitest.config.ts`, `playwright.config.ts`, `package.json` e `tasks.md` (sem threshold próprio; aplicados strong defaults).
- Contagem nas paths de `tasks.md`: baseline documentado de 22 casos, atual de 32 (+10); E2E de frequência passou de 4 para 7 casos. A contagem global anterior não estava registrada.

### Gate observado nesta verificação

- O resultado atual informado para `e2e/attendance.spec.ts` é 7/7; a última compilação consolidada `npm run build` passou.
- O teste separado `e2e/capacity.spec.ts` excedeu 180s e o teardown do trace expirou. Esse resultado é separado do build e do E2E funcional 7/7 desta frente.
- A verificação consolidada também registrou lint sem erros, `db:validate` e `git diff --check` aprovados. O unit-only global ficou 51/52 por falha em `encontros/page.test.tsx`; o typecheck global apontou `resetAccountPassword` ausente em arquivos da frente de contas. Esses dois erros são de paths de outras frentes.
- Não executei Vitest de integração diretamente: esta passada proibiu teste DB direto. O sensor usou exclusivamente `npm run test:e2e` do projeto; gates focais anteriores de Vitest/migration permanecem registrados nas seções históricas acima.

**Resumo:** critérios funcionais da frequência 10/10 cobertos; sensor 1/1 morto; sem gap de spec ou mutant sobrevivente. O build e o E2E funcional estão verdes; falhas globais de outras frentes e o timeout independente de capacidade estão discriminados acima.

## Resultado

Os critérios FREQ-01 a FREQ-05 desta frente estão cobertos por testes de serviço, integração e interface E2E. Os gates focais anteriores de build, lint, typecheck, Vitest, migration, E2E da frequência e whitespace passaram. Não há requisito funcional pendente identificado nesta frente.

Na verificação combinada mais recente do workspace, o full unit-only ficou 51/52 por falha de link administrativo em `encontros/page.test.tsx`, e o typecheck falhou por `resetAccountPassword` ausente em arquivos da frente de contas. Essas falhas não atingem os paths desta frente; seus gates focal anteriores passaram. Para novos E2Es, usar o runner temporário do projeto, por exemplo `rtk run -c 'PLAYWRIGHT_PORT=3101 npm run test:e2e -- e2e/attendance.spec.ts'`, sem URL de banco fixa.
