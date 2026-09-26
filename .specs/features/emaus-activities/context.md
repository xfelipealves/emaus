# Atividades compartilhadas — contexto

**Gathered**: 2026-08-20
**Spec**: `.specs/features/emaus-activities/spec.md`
**Status**: Ready for design

## Feature Boundary

Entregar uma área compartilhada de atividades no Emaús com os buckets `Amanhã`, `Backlog` e `Estacionado`, filtro de `Amanhã`, exclusão confirmada da atividade e CRUD de subtarefas.

## Implementation Decisions

### Compartilhamento

- Todos os usuários ativos/autorizados visualizam e editam a mesma lista.
- A atividade não pertence exclusivamente ao usuário que a criou.

### Organização

- `Amanhã` é uma área de fluxo, não uma data civil editável.
- O filtro deve ser discreto, mas ter label acessível para não ficar invisível para teclado/leitor de tela.

### Exclusão e subtarefas

- Exclusão é definitiva e pede confirmação explícita.
- Subtarefas são removidas em cascade com a atividade pai.
- Subtarefas aparecem na atividade em ordem de criação e permitem editar título/conclusão e excluir.

## Agent's Discretion

- Posicionamento visual do acesso à área de atividades, desde que seja discreto, acessível e não prejudique a navegação principal.
- Componentização conforme os padrões existentes de Server Components, Server Actions e `useActionState`.

## Declined / Undiscussed Gray Areas → Assumptions

- Não haverá vínculo com Pessoa, Ministério ou Encontro nesta primeira entrega.
- Não haverá datas arbitrárias, recorrência, atribuição individual, comentários ou notificações.

## Specific References

- O usuário pediu que a visualização de tarefas de amanhã ficasse “bem camuflada”; isso foi interpretado como seletor secundário/discreto, não como recurso oculto ou inacessível.
- O usuário confirmou que todos os usuários devem acessar e editar as atividades.

## Deferred Ideas

- Vincular atividades a entidades do domínio do Emaús.
- Evoluir `Amanhã` para datas civis e agenda.
