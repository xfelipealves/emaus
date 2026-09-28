# Ciclo de vida e histórico de Pessoas — validação

**Status:** Parcial. Os gates Vitest, lint direcionado e validação do schema passaram. E2E e build aguardam a janela serial da coordenação.

## RED comportamental observado

| Cenário | Preparação | Resultado |
|---|---|---|
| Filtro `status` reúne cadastro e mudança de status | O teste de integração foi executado contra uma cópia temporária da implementação anterior de `timeline-query.ts`, usando o novo contrato do teste. | RED válido: 1 falha e 7 aprovações. O filtro retornou `STATUS`, mas faltou `REGISTRATION` esperado. A implementação atual inclui ambas as categorias e o gate completo passou. |

O cenário E2E de data padrão local foi escrito antes da alteração de `status-actions.tsx` (`e2e/people.spec.ts:60-82`), mas o RED de browser não foi executado porque Playwright está reservado para a janela serial. Não há resultado comportamental de browser a reportar ainda.

## Gates executados

| Gate | Comando/escopo | Resultado |
|---|---|---|
| Unit + integration | `npm run test -- src/features/pessoas/person-service.integration.test.ts src/features/pessoas/person-query.integration.test.ts src/features/pessoas/status-service.test.ts src/features/pessoas/status-service.integration.test.ts src/features/timeline/timeline-query.integration.test.ts src/features/timeline/note-service.integration.test.ts`, com configuração protegida apontando à base descartável exclusiva `emaus_e2e_people` | **Passou:** 6 arquivos, 25 testes. Nenhum reset foi executado nesta retomada. |
| Lint | ESLint nos dois testes E2E e nos arquivos TS/TSX alterados desta feature | **Passou**, sem avisos nos paths direcionados. |
| Prisma schema | `npm run db:validate` | **Passou:** schema válido. |
| Typecheck do workspace | Execução anterior nesta rodada | **Falhou fora do escopo desta feature:** `TS2345` em `src/app/(dashboard)/encontros/[meetingId]/actions.ts:22`, arquivo da frente de frequência. Não foi alterado por esta frente. |

## Pendências de execução e setup

- **E2E:** `e2e/people.spec.ts` e `e2e/people-profile.spec.ts` foram ampliados, sem remover testes; todos os `page.goto` aguardam `load` antes das interações com formulários/client actions. A execução aguarda liberação serial para `PLAYWRIGHT_PORT=3103` e, agora, o conserto do isolamento do `globalSetup`. Não foi tentada nesta rodada por instrução da coordenação. Portanto, cadastro e promoção pela interface, inativação após reload, rota direta, filtros da timeline e arquivo/autoria/versões de nota ainda não têm evidência de browser.
- **Isolamento do globalSetup:** após esta rodada de gates, a coordenação reportou que o wrapper da execução Playwright deixou o `globalSetup` ler `.env` e executar `prisma migrate reset --force` no banco `emaus`. Este worker não executou Playwright. A coordenação pausou novos acessos a banco e testes Prisma/Vitest de integração até confirmar uma forma de forçar o alvo descartável no Prisma CLI. Esse incidente é de setup/isolamento, não um RED funcional desta feature. Não registrar nem inspecionar URLs ou credenciais.
- **Setup do browser:** o binário Chromium headless estava ausente numa tentativa anterior; a instalação ficou a cargo da coordenação. Essa interrupção de setup não foi classificada como RED funcional. Mesmo com browser disponível, a janela serial continua sendo a condição para executar E2E.
- **Build:** não executado enquanto E2E/build aguardam a janela serial. O typecheck já tem o bloqueio externo descrito acima.
- **Lessons:** a carga foi bloqueada após o script do skill causar efeito colateral nos arquivos globais de lessons; o design registra a decisão de não executar esse script novamente nesta rodada.

## Rastreabilidade por critério de aceite

| AC | Evidência de implementação e teste | Execução |
|---|---|---|
| PERS-01 — visitante sem telefone/nascimento e evento de cadastro | `src/features/pessoas/person-service.integration.test.ts:42-70`; `e2e/people.spec.ts:47-63` | Integration passou; E2E pendente. |
| PERS-02 — data inicial editável, campos obrigatórios, persistência/data local, timeline e auditoria | `src/app/(dashboard)/pessoas/[personId]/status-actions.tsx:8-20,38-42`; `src/features/pessoas/status-service.test.ts:4-24`; `src/features/pessoas/status-service.integration.test.ts:46-144`; `e2e/people.spec.ts:60-88` | Unit/integration passaram; E2E pendente. |
| PERS-03 — inativação preserva perfil, vínculo, presença, nota, versões e timeline | `src/features/pessoas/status-service.integration.test.ts:146-224`; `e2e/people.spec.ts:89-157` | Integration passou; E2E pendente. |
| PERS-04 — navegação, ordem, todos os filtros e notas arquivadas | `src/features/timeline/timeline-query.ts:20-26,56-63`; `src/app/(dashboard)/pessoas/[personId]/timeline/page.tsx:10-17,52-85`; `src/features/timeline/timeline-query.integration.test.ts:50-99`; `src/features/timeline/note-service.integration.test.ts:67-83`; `e2e/people-profile.spec.ts:114-183,203-233` | Integration passou; E2E pendente. |
| PERS-05 — escopo direto e dia local exibido | `src/app/(dashboard)/pessoas/[personId]/timeline/page.tsx:39-48,85`; `e2e/people.spec.ts:16-23,133-157`; `e2e/people-profile.spec.ts:102-111,114-183` | Query e gates não-browser passaram; E2E pendente. |

Nenhum teste foi removido ou ignorado. O fechamento dos critérios visuais e da autorização pela rota requer executar os dois arquivos E2E, conferir os resultados e então concluir o gate Build.

## Casos de borda do spec

| Caso | Evidência | Execução nesta rodada |
|---|---|---|
| Nome duplicado continua permitido no cadastro rápido | `e2e/people.spec.ts:47-63` cria um registro homônimo e verifica a contagem dois após o cadastro. | E2E pendente. |
| Nascimento vazio não produz idade | `src/features/pessoas/person-query.integration.test.ts:64-78`; confirmação visual em `e2e/people.spec.ts:55-63`. | Integration passou; E2E pendente. |
| Promoção sem qualquer campo obrigatório não altera campos/eventos | `src/features/pessoas/status-service.integration.test.ts:71-112`; E2E em `e2e/people.spec.ts:70-79`. | Integration passou; E2E pendente. |
| Falha transacional não deixa status, timeline e auditoria divergentes | `src/features/pessoas/status-service.integration.test.ts:114-144`. | Integration passou. |
| Nota arquivada mantém autoria/versões e só aparece no filtro arquivado | `src/features/timeline/note-service.integration.test.ts:67-83`; E2E em `e2e/people-profile.spec.ts:203-233`. | Integration passou; E2E pendente. |
| Pessoa inativa conserva histórico e segue sujeita ao escopo | `src/features/pessoas/status-service.integration.test.ts:146-224`; `e2e/people.spec.ts:126-162`; acesso direto em `e2e/people-profile.spec.ts:102-111`. | Integration passou; E2E pendente. |
