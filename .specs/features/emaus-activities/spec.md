# Atividades compartilhadas — especificação

**Status**: In Progress

## Problem Statement

O Emaús já organiza pessoas, ministérios e encontros, mas ainda não oferece um lugar comum para registrar pendências operacionais. O time precisa criar atividades, separar o que deve ser tratado amanhã do que está no backlog ou estacionado, remover uma atividade que deixou de fazer sentido e quebrar uma atividade em subtarefas administráveis.

## Goals

- [ ] Disponibilizar uma área discreta e acessível de atividades compartilhadas para usuários ativos do Emaús.
- [ ] Permitir organizar atividades em `Amanhã`, `Backlog` e `Estacionado`, com consulta filtrada de `Amanhã`.
- [ ] Permitir excluir atividades e manter subtarefas consistentes por meio de CRUD completo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Associação com Pessoa, Ministério ou Encontro | O usuário confirmou a necessidade de atividades compartilhadas, mas não definiu vínculo com entidades do domínio; fica para uma evolução posterior. |
| Datas arbitrárias, recorrência e calendário | O corte solicitado usa `Amanhã` como área de trabalho, não como agenda de datas livres. |
| Atribuição individual, comentários e notificações | Não foram solicitados neste corte. |
| Soft delete e restauração | A solicitação é excluir; a exclusão será definitiva e explícita. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Visibilidade | Todos os usuários ativos/autorizados visualizam e editam todas as atividades | Foi a decisão explícita do usuário; não haverá ownership por criador | Yes |
| Significado de `Amanhã` | Bucket de fluxo (`TOMORROW`), sem data civil persistida | Mantém o comportamento pedido simples e evita misturar atividade com agenda | Assumed for this cut |
| Exclusão da atividade | Exclusão definitiva com cascade das subtarefas | Evita subtarefas órfãs e torna o resultado observável | Assumed for this cut |
| Confirmação de exclusão | A interface exige confirmação explícita | Mantém o padrão de segurança já usado para ações destrutivas | Assumed from project pattern |
| Ordenação das subtarefas | Mais antigas primeiro | Não foi solicitada ordenação manual; preserva previsibilidade | Assumed for this cut |

**Open questions**: none blocking this cut; the out-of-scope association decision is intentionally deferred.

## User Stories

### P1: Organizar atividades compartilhadas ⭐ MVP

**User Story**: Como usuário ativo do Emaús, quero criar e consultar atividades compartilhadas por área para saber o que fazer amanhã e o que aguarda decisão.

**Acceptance Criteria**:

1. WHEN um usuário ativo abre `/atividades` THEN o sistema SHALL mostrar as atividades compartilhadas e as áreas `Amanhã`, `Backlog` e `Estacionado`.
2. WHEN um usuário cria uma atividade com título não vazio e uma área válida THEN o sistema SHALL persistir a atividade e exibi-la na área selecionada.
3. WHEN o usuário seleciona o filtro `Amanhã` THEN o sistema SHALL exibir somente atividades do bucket `TOMORROW`.
4. WHEN o usuário informa título vazio THEN o sistema SHALL rejeitar o envio sem persistir uma atividade.
5. WHEN uma conta inativa tenta consultar ou alterar atividades THEN o sistema SHALL rejeitar a operação.

**Independent Test**: autenticar com uma conta demo, criar uma atividade em cada área e usar o seletor para confirmar o conjunto retornado.

### P1: Gerenciar subtarefas ⭐ MVP

**User Story**: Como usuário ativo do Emaús, quero criar, visualizar, editar/concluir e excluir subtarefas para decompor uma atividade.

**Acceptance Criteria**:

1. WHEN o usuário cria uma subtask com título não vazio THEN o sistema SHALL vinculá-la à atividade correta e exibi-la.
2. WHEN o usuário edita o título ou o estado de conclusão de uma subtask THEN o sistema SHALL persistir os novos valores.
3. WHEN o usuário exclui uma subtask THEN o sistema SHALL removê-la sem remover a atividade pai.
4. WHEN o usuário tenta criar ou atualizar uma subtask com título vazio THEN o sistema SHALL rejeitar a operação.

**Independent Test**: criar uma atividade, criar uma subtask, editar/concluir, excluir e confirmar que a atividade continua presente.

### P1: Excluir atividade com segurança ⭐ MVP

**User Story**: Como usuário ativo do Emaús, quero excluir uma atividade que não é mais necessária sem deixar subtarefas órfãs.

**Acceptance Criteria**:

1. WHEN o usuário solicita exclusão THEN a interface SHALL exigir confirmação explícita antes do envio.
2. WHEN a exclusão é confirmada THEN o sistema SHALL remover a atividade e todas as suas subtarefas.
3. WHEN a exclusão é cancelada THEN o sistema SHALL manter a atividade e suas subtarefas sem alteração.

**Independent Test**: criar atividade com subtask, cancelar uma primeira confirmação, confirmar depois e consultar a base/lista para comprovar a remoção.

## Edge Cases

- WHEN o bucket não pertence a `TOMORROW`, `BACKLOG` ou `PARKED` THEN a operação SHALL ser rejeitada.
- WHEN a atividade ou subtask informada não existe THEN a operação SHALL retornar erro contextual sem criar alteração parcial.
- WHEN uma atividade é excluída THEN nenhuma subtask vinculada SHALL permanecer.
- WHEN dois usuários ativos consultam a área THEN ambos SHALL receber a mesma lista compartilhada após a persistência.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ACT-01 | P1: Organizar atividades compartilhadas | Design | Pending |
| ACT-02 | P1: Organizar atividades compartilhadas | Design | Pending |
| ACT-03 | P1: Organizar atividades compartilhadas | Design | Pending |
| ACT-04 | P1: Gerenciar subtarefas | Design | Pending |
| ACT-05 | P1: Excluir atividade com segurança | Design | Pending |
| ACT-06 | P1: Excluir atividade com segurança | Design | Pending |
| ACT-07 | P1: Auth e integridade | Design | Pending |

**Coverage**: 7 total, 0 mapped to tasks, 7 pending.

## Success Criteria

- [ ] Usuários ativos conseguem criar e consultar atividades compartilhadas nas três áreas.
- [ ] O filtro de `Amanhã` não mistura atividades de outros buckets.
- [ ] CRUD de subtarefas funciona sem deixar registros órfãos.
- [ ] Exclusão exige confirmação e remove a atividade com suas subtarefas.
- [ ] A suíte de testes existente continua passando sem regressões.
