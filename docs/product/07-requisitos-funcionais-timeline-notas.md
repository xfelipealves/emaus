# Requisitos Funcionais — Timeline e Notas

**Status:** primeira rodada de especificação aprovada na descoberta

## RF-TIM-001 — Eventos automáticos na timeline

O perfil de cada pessoa deve apresentar uma timeline com todos os eventos relevantes do seu relacionamento com a igreja.

**Eventos incluídos automaticamente no MVP:**

- cadastro da pessoa;
- mudança de status, como visitante, membro ou inativo;
- entrada e saída de ministério;
- criação de nota;
- presença, ausência ou estado não confirmado em encontro;
- correção de presença;
- arquivamento de nota, quando aplicável.

## RF-TIM-002 — Ordenação e filtros

A timeline deve mostrar eventos mais recentes primeiro.

**Regras e critérios de aceite:**

- usuário pode filtrar eventos por tipo;
- filtros devem permitir ao menos distinguir cadastro/status, ministérios, frequência, notas e correções;
- os filtros não alteram nem ocultam dados permanentemente; apenas mudam a consulta atual.

## RF-TIM-003 — Notas em texto simples

Notas de acompanhamento aceitam somente texto simples no MVP.

**Fora deste requisito:**

- anexos;
- imagens e documentos;
- menções a usuários;
- tarefas associadas;
- comentários em notas.

## RF-TIM-004 — Arquivamento de nota

Uma nota arquivada deve ser ocultada da visualização padrão da timeline.

**Regras e critérios de aceite:**

- usuário com acesso ao perfil pode habilitar filtro para visualizar notas arquivadas;
- arquivamento não exclui a nota definitivamente;
- autoria, criação e última alteração permanecem preservadas;
- as permissões de visualização continuam seguindo o acesso ao perfil da pessoa.

## Decisões ainda abertas

- se a edição de nota deve criar versões completas ou somente registrar data/hora da última alteração;
- tamanho máximo de uma nota;
- se algum evento automático poderá ser ocultado por permissão específica no futuro.
