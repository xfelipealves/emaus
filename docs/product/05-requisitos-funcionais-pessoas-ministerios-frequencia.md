# Requisitos Funcionais — Pessoas, Ministérios e Frequência

**Status:** primeira rodada de especificação aprovada na descoberta

Este documento traduz as decisões de negócio em comportamentos funcionais do MVP. Ele ainda não define interface, banco de dados ou stack.

## 1. Pessoas

### RF-PES-001 — Cadastro rápido de visitante

Um usuário autorizado deve poder cadastrar um visitante informando apenas o nome completo.

**Regras e critérios de aceite:**

- nome completo é o único campo obrigatório nesse fluxo;
- telefone, data de nascimento, foto e demais dados podem ser preenchidos depois;
- o sistema não bloqueia nem exibe alerta de duplicidade no MVP;
- o cadastro cria uma pessoa com status `visitante`;
- o sistema registra o evento de cadastro na timeline da pessoa.

### RF-PES-002 — Promoção para membro

Um usuário autorizado deve poder alterar o status de uma pessoa de visitante para membro.

**Regras e critérios de aceite:**

- telefone e data de nascimento se tornam obrigatórios na promoção;
- a data da mudança é preenchida com o dia atual por padrão;
- o usuário pode ajustar essa data para refletir a data real do acontecimento;
- a mudança entra na timeline e não remove registros anteriores da pessoa.

### RF-PES-003 — Inativação e arquivamento

Um usuário autorizado deve poder alterar o status de uma pessoa para inativo.

**Regras e critérios de aceite:**

- a pessoa inativa não é excluída definitivamente;
- o perfil, vínculos ministeriais, presenças e timeline permanecem consultáveis conforme a permissão do usuário;
- não haverá exclusão física de pessoa no MVP;
- a mudança de status entra na timeline com data ajustável.

### RF-PES-004 — Foto de perfil

O sistema deve permitir adicionar e atualizar foto no perfil de visitante ou membro.

**Regras e critérios de aceite:**

- foto é opcional em todos os status;
- falta de foto nunca bloqueia cadastro ou promoção a membro.

### RF-PES-005 — Notas de acompanhamento

Um usuário com acesso ao perfil deve poder criar, editar e arquivar notas de acompanhamento.

**Regras e critérios de aceite:**

- cada nota registra autor e data/hora de criação;
- edições registram a data/hora da última alteração;
- arquivamento não apaga a nota de forma definitiva;
- a criação da nota aparece na timeline;
- regras mais restritivas de confidencialidade pastoral não fazem parte deste MVP.

## 2. Ministérios e vínculos

### RF-MIN-001 — Administração de ministérios

Somente administradores podem criar, editar ou arquivar ministérios.

**Regras e critérios de aceite:**

- ministérios são customizáveis pela igreja;
- um ministério pode representar uma área, público ou serviço, como Jovens, Adolescentes ou Louvor;
- ministério arquivado preserva vínculos e histórico existentes;
- ministério arquivado não recebe novos vínculos nem novos lançamentos de presença.

### RF-MIN-002 — Vínculo de pessoa a ministério

Um administrador deve poder vincular uma pessoa a um ou mais ministérios.

**Regras e critérios de aceite:**

- uma pessoa pode ter vários vínculos ministeriais ativos ou históricos;
- o vínculo registra data de entrada, preenchida com a data atual por padrão e ajustável pelo usuário;
- o vínculo pode receber data de saída;
- o encerramento do vínculo não remove o histórico da pessoa nem do ministério;
- entrada e saída de ministério aparecem na timeline da pessoa.

### RF-MIN-003 — Cargo fixo no vínculo

Cada vínculo ministerial pode ter um dos cargos fixos `líder` ou `membro`.

**Regras e critérios de aceite:**

- cargo pertence ao vínculo, não ao perfil global da pessoa;
- a mesma pessoa pode ter cargos diferentes em ministérios diferentes;
- cargo e permissão de acesso ao sistema são conceitos independentes;
- cargos customizáveis são evolução futura e não fazem parte do MVP.

## 3. Encontros e frequência

### RF-ENC-001 — Categorias de encontro

Administradores devem poder criar categorias customizáveis para encontros.

**Exemplos:** culto, reunião, programação, célula, EBD ou evento.

### RF-ENC-002 — Séries recorrentes

Um administrador deve poder criar uma série recorrente de encontros.

**Regras e critérios de aceite:**

- a série pode representar, por exemplo, um culto semanal;
- cada ocorrência gerada é um encontro individual;
- uma ocorrência pode ser editada sem obrigar a alteração das demais ocorrências da série.

### RF-ENC-003 — Definição de público do encontro

Ao criar um encontro, o usuário autorizado deve definir seu público-alvo.

**Regras e critérios de aceite:**

- o encontro pode envolver todos os membros ativos;
- alternativamente, pode envolver um ou mais ministérios selecionados;
- visitantes não precisam estar no público pré-carregado para receber presença.

### RF-ENC-004 — Lançamento de frequência

Um usuário com acesso ao encontro deve poder registrar presença de pessoas na lista do encontro.

**Regras e critérios de aceite:**

- cada pessoa pré-carregada inicia como `não confirmado`;
- os estados possíveis são `presente`, `ausente` e `não confirmado`;
- o sistema deve permitir pesquisar pessoa existente durante o lançamento;
- o sistema deve permitir cadastrar rapidamente um visitante somente com nome, sem sair da lista de frequência;
- a presença registrada aparece na timeline da pessoa.

### RF-ENC-005 — Correção auditável de presença

Um usuário com acesso ao encontro deve poder corrigir uma presença a qualquer momento.

**Regras e critérios de aceite:**

- o sistema registra valor anterior e valor posterior;
- o sistema registra autor e data/hora da correção;
- o histórico de auditoria permanece consultável;
- a correção aparece na timeline da pessoa.

### RF-ENC-006 — Consultas mínimas de frequência

O MVP deve permitir consultar:

- histórico individual de frequência no perfil da pessoa;
- lista de presença por encontro;
- resumo de frequência por ministério.

Alertas automáticos de baixa frequência e dashboards avançados permanecem fora do MVP.

## Decisões ainda abertas nestes módulos

- quais campos adicionais existirão no perfil de membro além de nome, telefone, data de nascimento e foto;
- como será a pesquisa de pessoa quando houver nomes iguais, já que o MVP não alerta duplicidade;
- quais regras de recorrência serão suportadas inicialmente (semanal, mensal, dias específicos etc.);
- se a auditoria de correção exigirá motivo textual;
- qual período e quais métricas compõem o resumo de frequência por ministério.
