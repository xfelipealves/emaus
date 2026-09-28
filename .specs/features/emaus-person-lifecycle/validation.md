# Ciclo de vida e histórico de Pessoas — validação

**Status:** Unit/integration focal, lint direcionado, validação do schema, E2E e build de produção passaram. Typecheck/unit-only globais têm falhas fora desta frente; integração consolidada não foi repetida após o incidente de isolamento.

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
