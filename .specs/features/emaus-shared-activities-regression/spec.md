# Regressão E2E de atividades compartilhadas — especificação

**Status:** Draft de cobertura de aceitação; não declara defeito de produto confirmado.

## Problema

O E2E confirmou que o Líder concluiu subtarefa compartilhada e que ela persistiu após recarga; também confirmou exclusão de atividade QA e subtarefa. Não foi possível testar o cancelamento de confirmação de exclusão; a exceção da sessão Secretaria bloqueou sua cobertura. A especificação de atividades afirma que todos os usuários ativos autorizados compartilham a mesma lista.

## Objetivos

- [ ] Demonstrar critérios ACT-01 a ACT-07 nas sessões Admin, Secretaria e Líder.
- [ ] Verificar lista compartilhada, filtros, subtarefas e exclusão com confirmação/cancelamento.
- [ ] Manter dados de demonstração intactos e não depender de clique que permaneça ambíguo.

## Fora de escopo

| Item | Motivo |
|---|---|
| Atribuição individual, comentários ou notificações | Excluídos por `emaus-activities/spec.md`. |
| Reverter exclusão depois da confirmação | Exclusão é definitiva e não há restauração prevista. |
| Associar atividade a Pessoa/Ministério/Encontro | Fora de escopo da feature existente. |

## Premissas

| Tema | Padrão | Fonte | Confirmado? |
|---|---|---|---|
| Compartilhamento | Todos os perfis ativos/autorizados consultam e editam a mesma lista | Decisão explícita em `emaus-activities/context.md`. | Sim. |
| Exclusão | Confirmada remove atividade e subtarefas; cancelada mantém ambas | ACT-05/06. | Sim. |
| Test data | Identificadores QA únicos e removíveis, sem dados de seed | Prática segura para E2E manual/automatizado. | Proposta de teste. |

**Questões em aberto:** nenhuma questão funcional conhecida; testar o diálogo nativo/operacional de confirmação no ambiente real do browser.

## Histórias e critérios de aceite

### P1 — Atividade visível e sincronizada entre papéis

1. **WHEN** usuário ativo abre atividades **THEN** o sistema **SHALL** mostrar as áreas `Amanhã`, `Backlog` e `Estacionado` e as atividades compartilhadas.
2. **WHEN** Admin cria atividade QA em cada bucket **THEN** Secretaria e Líder ativos **SHALL** ver a mesma atividade após atualização da consulta.
3. **WHEN** Líder ou Secretaria edita um estado permitido **THEN** os outros perfis **SHALL** ver o resultado persistido após recarga.
4. **WHEN** filtro `Amanhã` é escolhido **THEN** somente atividades `TOMORROW` **SHALL** aparecer.
5. **WHEN** conta está desativada **THEN** o sistema **SHALL** negar consulta e mutação conforme ACT-07.

### P1 — Ciclo de subtarefa

1. **WHEN** usuário ativo cria subtarefa com título válido **THEN** ela **SHALL** aparecer na atividade correta.
2. **WHEN** usuário altera título ou conclusão e salva **THEN** o sistema **SHALL** persistir a mudança, atualizar contador e manter o valor após reload.
3. **WHEN** usuário envia título vazio **THEN** o sistema **SHALL** rejeitar a operação sem criar/alterar subtarefa.
4. **WHEN** usuário remove subtarefa **THEN** o sistema **SHALL** remover somente essa subtarefa e preservar a atividade pai.

### P1 — Confirmar ou cancelar exclusão

1. **WHEN** usuário solicita exclusão de atividade **THEN** a interface **SHALL** solicitar confirmação antes de enviar a ação.
2. **WHEN** usuário cancela a confirmação **THEN** atividade e subtarefas **SHALL** permanecer inalteradas após recarga.
3. **WHEN** usuário confirma exclusão **THEN** atividade e todas as subtarefas **SHALL** desaparecer da lista após recarga.
4. **WHEN** diálogo está aberto **THEN** os controles de cancelar e confirmar **SHALL** ser distinguíveis e operáveis por teclado e ponteiro.

**Teste independente:** usar atividade e subtarefa com identificadores QA exclusivos; alternar entre três sessões ativas; testar cancelamento primeiro, conferir persistência; depois confirmar exclusão e conferir ausência em todas as sessões.

## Casos de borda

- Resposta de salvamento tardia não deve apresentar contador diferente do estado persistido.
- Recarregar durante operação pendente deve manter o estado do servidor.
- Atividade pai inexistente deve produzir erro sem subtask órfã.
- Exclusão em repetição não deve remover outra atividade homônima.
- Erro de uma role não altera estado observado pelas demais.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| ACT-E2E-01 | ACT-01/02/03/07 | Compartilhamento 1–5 | Draft |
| ACT-E2E-02 | ACT-04 | Subtarefas 1–4 | Draft |
| ACT-E2E-03 | ACT-05/06 | Exclusão 1–4 | Draft |

**Cobertura:** 3 agrupamentos rastreados aos 7 critérios ACT; cobertura Secretaria aguarda correção da exceção runtime.

## Sucesso

- [ ] Os três papéis veem o mesmo estado persistido.
- [ ] Salvar conclusão mostra contador correto antes e depois de recarregar.
- [ ] Cancelar não modifica dados; confirmar remove atividade e subtarefas.
- [ ] Nenhum dado semeado é alterado pelo cenário.
