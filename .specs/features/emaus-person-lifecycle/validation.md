# Ciclo de vida e histórico de Pessoas — validação

**Status:** Unit/integration focal, lint, schema, unit-only atual (80/80) e rodada E2E integrada (31/31) passaram. Build de produção passou em gate histórico. Typecheck falha por import ausente na frente de Contas; integração consolidada não foi repetida após o incidente de isolamento.

## RED comportamental observado

| Cenário | Preparação | Resultado |
|---|---|---|
| Filtro `status` reúne cadastro e mudança de status | O teste de integração foi executado contra uma cópia temporária da implementação anterior de `timeline-query.ts`, usando o novo contrato do teste. | RED válido: 1 falha e 7 aprovações. O filtro retornou `STATUS`, mas faltou `REGISTRATION` esperado. A implementação atual inclui ambas as categorias; os gates focal de integração, E2E e o build consolidado passaram. |

O E2E da data padrão local (`e2e/people-profile.spec.ts:115-137` e `e2e/people.spec.ts:65-92`) passou no runner serial após o isolamento ser validado.

## Falha de teste corrigida

Na primeira passagem pelo runner, 7 testes de perfil passaram e o cenário de inativação falhou porque `getByRole("status")` encontrou ao mesmo tempo o aviso da promoção e o sucesso de criação da nota. Era uma asserção ambígua, não uma falha funcional. A asserção passou a identificar `Nota adicionada.` por texto exato; a execução final passou 8/8.

## Gates executados

| Gate | Comando/escopo | Resultado |
|---|---|---|
| Unit + integration | `npm run test -- src/features/pessoas/person-service.integration.test.ts src/features/pessoas/person-query.integration.test.ts src/features/pessoas/status-service.test.ts src/features/pessoas/status-service.integration.test.ts src/features/timeline/timeline-query.integration.test.ts src/features/timeline/note-service.integration.test.ts`, com configuração protegida apontando à base descartável exclusiva `emaus_e2e_people` | **Passou:** 6 arquivos, 25 testes. Nenhum reset foi executado nesta retomada. |
| E2E | `rtk run -c 'PLAYWRIGHT_PORT=3103 npm run test:e2e -- e2e/people.spec.ts e2e/people-profile.spec.ts'` | **Passou:** 8 testes, 1 worker; `people-profile.spec.ts` 7/7 e `people.spec.ts` 1/1. As 2 guardas do runner também passaram. PostgreSQL memory-backed efêmero; container removido ao final e porta 3103 livre. |
| Lint | ESLint nos dois testes E2E e nos arquivos TS/TSX alterados desta feature | **Passou**, sem avisos nos paths direcionados. |
| Prisma schema | `npm run db:validate` | **Passou:** schema válido. |
| Diff check | `git diff --check` nos paths exclusivos desta feature | **Passou.** |
| Full unit-only | Resultado compartilhado reportado pela coordenação | **51/52; 1 falha externa** em `src/app/(dashboard)/encontros/page.test.tsx`, assertion de link de categorias. Não pertence a esta feature. |
| Typecheck do workspace | Resultado compartilhado reportado pela coordenação | **Falhou fora do escopo:** `src/features/auth/account-service.integration.test.ts` importa `resetAccountPassword`, que não existe na frente de contas. Não foi alterado por esta frente. |
| Build de produção | `rtk run -c 'npm run test:e2e -- --capacity'` — runner com PostgreSQL temporário em tmpfs | **Build passou:** compilação, checagem de tipos do Next e geração de páginas concluídas. O teste de capacidade que roda depois do build excedeu 180 s e falhou no teardown do trace; o container foi removido. |

## Pendências de execução e setup

- **Build:** passou em 2026-09-28 no runner isolado. O cenário de capacidade separado excedeu 180 s; isso não altera o E2E funcional da frente, 8/8. **Integração consolidada:** não repetida após o incidente de isolamento. A coordenação reportou full unit-only 51/52 (uma falha externa em `encontros/page.test.tsx`) e typecheck falhando pelo símbolo `resetAccountPassword` ausente em `src/features/auth/account-service.integration.test.ts`. A rodada focal de 25/25 permanece evidência anterior.
- **Isolamento do globalSetup:** uma execução anterior com wrapper incorreto caiu em `.env` e resetou o banco padrão; a coordenação pausou acessos. O runner temporário usado na execução E2E aprovada passou as guardas 2/2 (aceita somente formato loopback gerado, rejeita base local compartilhada/remota), criou PostgreSQL memory-backed efêmero, aplicou migrations/seed e removeu o container. A porta 3103 está livre. O incidente anterior foi setup/isolamento, não RED funcional desta feature; não registrar URLs ou credenciais.
- **Setup do browser:** Chromium headless ausente numa tentativa anterior; instalação central concluída, comprovada pela suíte E2E verde.
- **Lessons:** a carga foi bloqueada após o script do skill causar efeito colateral nos arquivos globais de lessons; o design registra a decisão de não executar esse script novamente nesta rodada.

## Rastreabilidade por critério de aceite

| AC | Evidência de implementação e teste | Execução |
|---|---|---|
| PERS-01 — visitante sem telefone/nascimento e evento de cadastro | `src/features/pessoas/person-service.integration.test.ts:42-70`; `e2e/people.spec.ts:47-63` | Integration e E2E passaram. |
| PERS-02 — data inicial editável, campos obrigatórios, persistência/data local, timeline e auditoria | `src/app/(dashboard)/pessoas/[personId]/status-actions.tsx:8-20,38-42`; `src/features/pessoas/status-service.test.ts:4-24`; `src/features/pessoas/status-service.integration.test.ts:46-144`; `e2e/people.spec.ts:65-92`; `e2e/people-profile.spec.ts:115-137` | Unit, integration e E2E passaram. |
| PERS-03 — inativação preserva perfil, vínculo, presença, nota, versões e timeline | `src/features/pessoas/status-service.integration.test.ts:146-224`; `e2e/people.spec.ts:94-162` | Integration e E2E passaram. |
| PERS-04 — navegação, ordem, todos os filtros e notas arquivadas | `src/features/timeline/timeline-query.ts:20-26,56-63`; `src/app/(dashboard)/pessoas/[personId]/timeline/page.tsx:10-17,52-85`; `src/features/timeline/timeline-query.integration.test.ts:50-99`; `src/features/timeline/note-service.integration.test.ts:67-83`; `e2e/people-profile.spec.ts:139-217,236-267` | Integration e E2E passaram. |
| PERS-05 — escopo direto e dia local exibido | `src/app/(dashboard)/pessoas/[personId]/timeline/page.tsx:39-48,85`; `e2e/people.spec.ts:16-23,138-162`; `e2e/people-profile.spec.ts:104-137` | Query e E2E passaram. |

Nenhum teste foi removido ou ignorado. Todos os ACs desta feature têm execução unit/integration ou E2E aprovada; o build de produção passou no runner isolado.

## Casos de borda do spec

| Caso | Evidência | Execução nesta rodada |
|---|---|---|
| Nome duplicado continua permitido no cadastro rápido | `e2e/people.spec.ts:47-63` cria um registro homônimo e verifica a contagem dois após o cadastro. | E2E passou. |
| Nascimento vazio não produz idade | `src/features/pessoas/person-query.integration.test.ts:64-78`; confirmação visual em `e2e/people.spec.ts:55-63`. | Integration e E2E passaram. |
| Promoção sem qualquer campo obrigatório não altera campos/eventos | `src/features/pessoas/status-service.integration.test.ts:71-112`; E2E em `e2e/people.spec.ts:70-79`. | Integration e E2E passaram. |
| Falha transacional não deixa status, timeline e auditoria divergentes | `src/features/pessoas/status-service.integration.test.ts:114-144`. | Integration passou. |
| Nota arquivada mantém autoria/versões e só aparece no filtro arquivado | `src/features/timeline/note-service.integration.test.ts:67-83`; E2E em `e2e/people-profile.spec.ts:236-267`. | Integration e E2E passaram. |
| Pessoa inativa conserva histórico e segue sujeita ao escopo | `src/features/pessoas/status-service.integration.test.ts:146-224`; `e2e/people.spec.ts:126-162`; acesso direto em `e2e/people-profile.spec.ts:104-112`. | Integration e E2E passaram. |

## Verificador independente — 2026-09-28

**Veredito: PASS com limitação de execução.** Os 12 ACs estão ligados abaixo a implementação e asserções concretas; o sensor unitário matou a mutação. O histórico acima registra os gates anteriores (incluindo E2E 8/8 e build de produção aprovado). Na repetição independente atual, o baseline E2E completo parou em uma asserção de valor obsoleta antes de três cenários seriais: 4 passaram, 1 falhou e 3 não executaram. A expectativa de `birthDate` em `e2e/people-profile.spec.ts:134` foi corrigida na cópia compartilhada para meia-noite UTC, representação date-only usada pelo serviço. Com essa atualização copiada para o scratch, o caso isolado de promoção passou 1/1, incluindo a exibição local e navegação à timeline.

| AC | Evidência `file:line` e valor/assertion | Resultado verificado |
|---|---|---|
| PERS-01.1 | `src/features/pessoas/person-service.integration.test.ts:42-70` espera `VISITOR`, telefone/nascimento `null`, evento `REGISTRATION` “Pessoa cadastrada” e auditoria; `e2e/people.spec.ts:47-63` cria nome duplicado e confere os mesmos valores. | Evidência focal anterior aprovada; cenário E2E de cadastro está no teste serial que passou na repetição. |
| PERS-02.1 | `src/app/(dashboard)/pessoas/[personId]/status-actions.tsx:20-28` usa `formatDateInput(new Date())`; `src/lib/dates.ts:14-29,154-157` calcula o calendário de `America/Sao_Paulo`; `e2e/people.spec.ts:65-69` e `e2e/people-profile.spec.ts:120-122` comparam o input com hoje local e alteram a data. | Focal E2E anterior aprovado; verificado novamente no cenário isolado de promoção, 1/1. |
| PERS-02.2 | `src/lib/dates.ts:59-86` interpreta datas de formulário sem mudar o dia e normaliza nascimento date-only; `src/features/pessoas/status-service.integration.test.ts:46-68` confere `MEMBER`, telefone, nascimento, `statusChangedAt`, evento e auditoria; `e2e/people-profile.spec.ts:122-145` confere dia escolhido `12/03/2024`, nascimento `22/02/1998` e valores persistidos. | Focal integration aprovado anteriormente; caso corrigido no scratch passou 1/1. `birthDate` persiste como `1998-02-22T00:00Z`; a data efetiva como `2024-03-12T12:00Z`, ambos exibem o mesmo dia escolhido. |
| PERS-02.3 | `src/app/(dashboard)/pessoas/[personId]/status-actions.tsx:24-28` marca telefone/nascimento `required` e apresenta erro; `src/features/pessoas/status-service.test.ts:22-32` exige mensagens específicas; `src/features/pessoas/status-service.integration.test.ts:71-112` envia cada campo ausente e espera status/dados/evento anterior inalterados; `e2e/people.spec.ts:65-79` verifica foco e valores após cada bloqueio. | Unit/integration anteriores aprovados; E2E focal anterior aprovado. |
| PERS-02.4 | `src/features/pessoas/status-service.ts:69-100` atualiza Pessoa, grava evento `STATUS` e auditoria dentro de `withTransaction`; `src/features/pessoas/status-service.integration.test.ts:46-68,114-144` confere evento/auditoria de promoção e rollback quando auditoria falha; `e2e/people.spec.ts:137-155` espera quatro eventos ao fim da jornada (cadastro, promoção, nota, inativação), datas dos dois status e auditoria `CREATE → PROMOTE_TO_MEMBER → INACTIVATE`. | Integration e E2E focais anteriores aprovados; implementação não remove eventos durante a promoção. A checagem E2E de retenção é por contagem final, não por assertion explícita de `REGISTRATION` após promoção. |
| PERS-03.1 | `src/features/pessoas/status-service.ts:103-141` só atualiza status/data e acrescenta status/auditoria; `src/features/pessoas/status-service.integration.test.ts:195-206` confere o mesmo ID, `INACTIVE`, data escolhida, vínculo e presença; `e2e/people.spec.ts:121-142` repete a persistência depois do fluxo UI. | Integration e E2E focais anteriores aprovados. |
| PERS-03.2 | `src/features/pessoas/status-service.ts:111-141` grava alteração, timeline e auditoria na transação; `src/features/pessoas/status-service.integration.test.ts:207-224` espera eventos antigos mais “Pessoa inativada”, nota/autoria/versão, vínculo, presença e auditoria; `e2e/people.spec.ts:131-162` recarrega perfil, verifica relações, timeline e datas. | Integration e E2E focais anteriores aprovados. |
| PERS-04.1 | `src/app/(dashboard)/pessoas/[personId]/page.tsx:81-84` liga a aba ao ID da própria Pessoa; `e2e/people-profile.spec.ts:142-145,148-162` espera URL `/pessoas/{id}/timeline` e heading da mesma Pessoa. | Navegação do cenário de promoção corrigido passou 1/1 no scratch; execução anterior também registrou o cenário de timeline entre os 8/8. |
| PERS-04.2 | `src/features/timeline/timeline-query.ts:21-27,57-63` mapeia filtros e ordena por `occurredAt desc, id desc`; `src/app/(dashboard)/pessoas/[personId]/timeline/page.tsx:10-17,72-88` fornece as cinco categorias e mostra eventos; `src/features/timeline/timeline-query.integration.test.ts:50-75` exige ordem e categorias; `e2e/people-profile.spec.ts:148-225` exige sequência, filtros, valores exatos e ID. | Integration/E2E focais anteriores aprovados. A tentativa de mutant E2E em scratch não alcançou o filtro: parou no click da aba, linha 161; por isso não é contada como sensor. |
| PERS-04.3 | `src/features/timeline/note-service.ts:51-57,141-168` separa lista ativa/arquivada e arquiva sem apagar versões; `src/features/timeline/note-service.integration.test.ts:67-83` espera nota fora da lista normal, uma na lista arquivada e duas versões; `e2e/people-profile.spec.ts:245-275` espera autoria, duas versões, ocultação após reload e conteúdo no filtro `Arquivadas`. | Integration e E2E focais anteriores aprovados. |
| PERS-05.1 | `src/features/pessoas/person-query.ts:121-148` retorna `null` quando o líder não tem escopo; `src/app/(dashboard)/pessoas/[personId]/page.tsx:31-47` e `timeline/page.tsx:39-48` negam perfil/timeline antes de carregar conteúdo; `e2e/people-profile.spec.ts:97-112` espera 404 e ausência de heading/evento/nota privada. | Os dois cenários de negação passaram na rodada integrada final 31/31. |
| PERS-05.2 | `src/lib/dates.ts:59-86,136-157` converte datas de formulário e formata no fuso local; `src/features/pessoas/status-service.ts:78-89,120-131` usa a data efetiva para status e evento; `e2e/people.spec.ts:37-38,81-92,121-162` confere timestamp UTC-noon e dia exibido após reload para promoção/inativação; `e2e/people-profile.spec.ts:120-145` confere promoção e `12/03/2024`. | Focal E2E anterior aprovado; promoção corrigida passou 1/1 no scratch. |

### Baseline, sensor e gaps ordenados

| Tipo | Resultado |
|---|---|
| Baseline independente em worktree scratch | Runner oficial, PostgreSQL efêmero memory-backed, porta 3103: **4 passaram, 1 falhou, 3 não executaram** (suite serial). Falha original em `e2e/people-profile.spec.ts:134`: teste esperava `birthDate` às 12:00 UTC, recebido à 00:00 UTC; UI apresentou `22/02/1998`, `statusChangedAt` e evento mantiveram 12:00 UTC. Após copiar a correção de expectativa date-only para o scratch, o cenário isolado de promoção passou **1/1**. Cada execução removeu o container. |
| Sensor comportamental | Em scratch, mutação da validação para aceitar telefone vazio; `rtk npm run test -- src/features/pessoas/status-service.test.ts` matou a mutação: a expectativa de erro em `status-service.test.ts:5-9` falhou, 1 teste falhou e 2 passaram. Arquivos compartilhados não foram tocados pelo sensor. |
| 1 — execução atual | Fechado pela rodada integrada final: `e2e/people-profile.spec.ts` e `e2e/people.spec.ts` passaram dentro da suíte 31/31, depois da correção da expectativa date-only de `birthDate`. O baseline independente inicial (4 pass, 1 fail, 3 não executados) fica preservado como histórico. |
| 2 — cobertura transacional | A transação bem-sucedida de inativação verifica dados/evento/auditoria; não há teste de fault injection específico que force falha de auditoria durante inativação e prove rollback dos três. A promoção tem esse teste de rollback e ambas usam `withTransaction`. |
| 3 — retenção de cadastro na promoção | A jornada E2E infere retenção pelo total de quatro eventos ao final; um assert direto do evento `REGISTRATION` após promoção tornaria essa parte de PERS-02.4 mais explícita. Serviço atual só cria evento de status e não remove os anteriores. |

### Preservação de histórico de execução

Os registros anteriores de build de produção, typecheck/unit-only externos, runner isolado, incidente de isolamento e timeout separado de capacidade permanecem nas seções acima. O timeout do cenário de capacidade (180 s durante teardown do trace) continua separado do build, que concluiu compilação, checagem de tipos do Next e geração de páginas. Esta rodada não alterou implementação nem testes compartilhados e não usou banco fixo.

## Rodada integrada final — 2026-09-28

O comando serial registrado na validação da Secretaria executou `e2e/people-profile.spec.ts` e `e2e/people.spec.ts`; os sete casos de perfil e o fluxo completo de ciclo de vida passaram. Total da rodada: **31/31 E2E em 3,8 min**, no banco temporário tmpfs `emaus_e2e_fc00faf5c5da`, removido pelo runner.

Depois da rodada, unit-only passou **80/80 em 22 arquivos**, lint passou sem erros (um warning existente de `<img>`), `db:validate`, `git diff --check` e `test:e2e:safety` (2/2) passaram. Typecheck segue bloqueado apenas pelo import ausente `resetAccountPassword` em teste de integração da frente de Contas. Permanecem dois gaps de precisão de cobertura: não há fault injection de rollback de auditoria durante inativação; e a retenção do evento `REGISTRATION` após promoção é inferida pela contagem final, sem asserção direta por tipo. O build de produção passou no estado atual pelo runner temporário com `rtk run -c 'npm run test:capacity -- --list'`; o comando listou o cenário sem executá-lo e removeu o banco tmpfs.
