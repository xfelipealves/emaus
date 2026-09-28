# Gestão de vínculos de pessoas a Ministérios — especificação

**Status:** Em implementação, com critérios derivados dos requisitos aprovados.
**Fontes:** RF-MIN-001/002/003, RF-ACS-006/007/008, RF-TIM-001 e RNF-005.

## Problema

O perfil do Ministério e o perfil da Pessoa mostram vínculos existentes, mas o E2E não encontrou uma interface para criar vínculos, alterar o cargo ou registrar a saída. Sem esse fluxo, a Administração não consegue manter pela plataforma a composição atual, o histórico e a lista que alimenta a frequência.

## Objetivos

- Permitir que somente o Administrador crie, consulte, altere cargo e encerre vínculos.
- Preservar os registros de vínculo e registrar entrada, mudança de cargo e saída na timeline e auditoria.
- Usar os vínculos vigentes nas consultas que já dependem deles.

## Fora de escopo

| Item | Motivo |
|---|---|
| Gestão por Secretaria ou Líder | RF-ACS-007/008 reservam gestão de vínculo ao Administrador. |
| Cargos ministeriais customizados | RF-MIN-003 oferece apenas `LÍDER` e `MEMBER` no MVP. |
| Conceder papel de acesso do sistema pelo cargo ministerial | RF-MIN-003 declara os conceitos independentes. |
| Editar dados gerais da Pessoa ou do Ministério | Fora do fluxo de vínculo. |

## Decisões de especificação

| Tema | Regra | Base |
|---|---|---|
| Cargo na entrada | O Administrador escolhe explicitamente `Membro` ou `Líder`; nenhum cargo é inferido do papel da conta. | RF-MIN-003 e separação cargo/papel do sistema. |
| Data inicial | Campo obrigatório, pré-preenchido com a data atual em `America/Sao_Paulo` e ajustável; datas são tratadas como dias de calendário. | RF-MIN-002 e utilitário `parseDateInput`. |
| Saída e mudança de cargo | Informar data efetiva; rejeitar data antes do início do vínculo. A saída encerra imediatamente e não pode ser futura; mudança de cargo só se aplica a vínculo vigente e a data não pode ser futura. | RF-MIN-002/003; o sistema consulta vínculo corrente pelo estado `endDate = null`, então uma saída futura não seria representada como vigente corretamente. |
| Reentrada | Permitir novo registro depois de vínculo anterior encerrado. O início deve ser posterior à última saída e não pode existir outro vínculo vigente para o mesmo par Pessoa/Ministério. | RF-MIN-002 permite vínculos ativos e históricos; a restrição impede duplicação/intervalo sobreposto sem bloquear retorno. |
| Ministério arquivado | Preservar consulta e permitir encerrar vínculo vigente já existente. Rejeitar novos vínculos e alteração de cargo; arquivamento não apaga história. | RF-MIN-001 proíbe novos vínculos e exige preservação do histórico. Encerrar um registro existente é manutenção de histórico, não nova associação. |
| Falha de auditoria/timeline | Reverter a operação inteira, sem vínculo/evento parcial. | RNF-005 e atomicidade transacional já usada nos serviços. |
| Registro da mudança de cargo | Manter o cargo corrente no vínculo; guardar data efetiva na timeline e na auditoria, junto do antes/depois. O histórico da Pessoa e o audit preservam a mudança. | RF-MIN-003 e RNF-005; o modelo atual não possui uma entidade separada de versões de cargo. |

## Histórias e critérios de aceite

### MEM-01 — Administrar vínculos como Administrador

1. **WHEN** um Administrador abre a área de vínculos de um Ministério **THEN** o sistema **SHALL** mostrar os registros vigentes e encerrados, com Pessoa, cargo e datas.
2. **WHEN** um Administrador abre a área **THEN** o formulário de entrada **SHALL** oferecer Pessoas existentes, os dois cargos fixos, e a data inicial atual de São Paulo, ajustável.
3. **WHEN** Secretaria ou Líder abre a URL da área **THEN** o servidor **SHALL** responder com acesso negado/404 antes de expor Pessoas ou controles administrativos.
4. **WHEN** Secretaria ou Líder submete uma operação de vínculo diretamente **THEN** o servidor **SHALL** negar sem gravar vínculo, timeline ou auditoria.

### MEM-02 — Criar e consultar vínculo

1. **WHEN** Administrador vincula uma Pessoa existente a Ministério ativo, informa cargo e data válida **THEN** o sistema **SHALL** salvar o vínculo com os valores informados e exibi-lo entre os vigentes.
2. **WHEN** o vínculo é criado **THEN** o sistema **SHALL** adicionar à timeline da Pessoa o Ministério, o cargo, a data efetiva e registrar auditoria com autor e valores persistidos.
3. **WHEN** Pessoa não existe, cargo/data estão inválidos, Ministério está arquivado, há vínculo vigente duplicado ou a nova entrada sobrepõe vínculo histórico **THEN** a operação **SHALL** falhar sem registro parcial.
4. **WHEN** o mesmo par Pessoa/Ministério tem vínculo encerrado e nenhum intervalo se sobrepõe **THEN** Administrador **SHALL** poder registrar uma reentrada independente, preservando ambos os registros.
5. **WHEN** gravar timeline ou auditoria falha **THEN** a transação **SHALL** reverter vínculo e eventos parciais.

### MEM-03 — Alterar cargo e encerrar vínculo

1. **WHEN** Administrador altera cargo de vínculo vigente para o outro cargo fixo com data efetiva entre início e hoje **THEN** o sistema **SHALL** manter o novo cargo corrente e registrar data, antes/depois, ator e Ministério em timeline/auditoria.
2. **WHEN** Administrador encerra vínculo vigente com data igual ou posterior ao início **THEN** o sistema **SHALL** preencher saída, mover o registro à seção histórica sem excluí-lo e emitir evento de saída na timeline/auditoria.
3. **WHEN** data de cargo/saída é anterior ao início ou futura, cargo não pertence ao conjunto permitido, ou mudança de cargo tenta operar em vínculo encerrado/Ministério arquivado **THEN** o sistema **SHALL** exibir erro e preservar os dados existentes.
4. **WHEN** vínculo já encerrado recebe outra tentativa de encerramento **THEN** o sistema **SHALL** rejeitar e preservar a data de saída anterior.

## Casos de borda

- Uma Pessoa pode ter vínculos em vários Ministérios e cargos diferentes em cada vínculo.
- Arquivar um Ministério não apaga nenhum vínculo nem evento de timeline/auditoria.
- Papel da conta e cargo ministerial continuam independentes.
- Vínculos são intervalos sem sobreposição para o mesmo par Pessoa/Ministério; reentrada requer saída anterior e nova data posterior à saída.
- Alteração de cargo não cria outro vínculo nem altera a data de entrada/saída.

## Rastreabilidade

| ID | Fonte | Cobertura |
|---|---|---|
| MEM-01 | RF-ACS-006/007/008, RNF-005 | consulta e autorização de tela/servidor |
| MEM-02 | RF-MIN-001/002/003, RF-TIM-001, RNF-005 | criação, consulta, reentrada e transação |
| MEM-03 | RF-MIN-002/003, RF-TIM-001, RNF-005 | alteração de cargo, encerramento e validação temporal |

## Sucesso

- Administrador conclui entrada, alteração de cargo e encerramento sem acessar o banco.
- Timeline e auditoria mostram autoria e datas efetivas, e o histórico permanece consultável.
- Secretaria e Líder não veem controles nem conseguem operar vínculos pela URL/servidor.
