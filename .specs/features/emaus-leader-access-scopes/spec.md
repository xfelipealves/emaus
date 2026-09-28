# Escopo ministerial de Líderes — especificação

**Status:** Implementado e E2E validado; build/regressão geral pendentes. Regra de visitante contextual decidida pelo usuário em 27/09/2026.

## Problema

O Líder autorizado a Demo Acolhimento conseguiu abrir o detalhe do Ministério e consultar participantes atuais/históricos, mas a lista `/ministerios` veio vazia. A UI administrativa de contas não apresenta controles para conceder/revogar escopo. O visitante rápido no encontro foi negado por falta de permissão para gerenciar Pessoas, em conflito potencial com RF-ENC-004.

## Objetivos

- [x] Aplicar o escopo concedido na listagem e nas operações do Líder.
- [x] Permitir que somente Administradores concedam e revoguem escopos de Ministério.
- [x] Registrar operações de escopo em auditoria e respeitar revogação sem apagar histórico.
- [x] Resolver explicitamente a permissão contextual de cadastro rápido de visitante.

## Fora de escopo

| Item | Motivo |
|---|---|
| Gestão geral de pessoas pelo Líder | RF-ACS-008 restringe consulta/ação às pessoas ligadas aos Ministérios concedidos. |
| Alterar cargo ministerial por conceder acesso de sistema | Requisitos dizem que cargo de Ministério e papel/permissão da conta são independentes. |
| Conceder escopo a papéis diferentes de Líder | RF-ACS-009 limita a concessão a contas de Líder. |

## Premissas e decisões pendentes

| Tema | Padrão proposto | Racional | Confirmado? |
|---|---|---|---|
| Lista do Líder | Exibir somente Ministérios ativos concedidos e não revogados | Coerente com limite de visibilidade por escopo. | Sim, deriva de RF-ACS-008/009. |
| Revogação | Impedir novas consultas/operações futuras sem apagar autoria ou registros anteriores | RF-ACS-009. | Sim. |
| Visitante rápido | Permitir somente criação contextual no quadro de frequência do encontro autorizado; não conceder gestão geral de Pessoas | Decisão explícita do usuário em 27/09/2026, compatibilizando RF-ENC-004 e RF-ACS-008. | Sim. |
| Pessoa vinculada a conta | Alterar escopo não altera cargo da pessoa nem papel da conta | RF-ACS-006/009. | Sim. |

**Questões em aberto:** não há questão de produto para visitante contextual. Detalhes de autorização server-side e tratamento transacional seguem para design.

## Histórias e critérios de aceite

### P1 — Consultar Ministérios concedidos

Como Líder, quero ver os Ministérios que me foram concedidos para operar dentro do meu escopo.

1. **WHEN** Líder autenticado abre `/ministerios` **THEN** o sistema **SHALL** listar cada Ministério ativo com acesso vigente concedido à conta.
2. **WHEN** Líder não tem nenhum acesso vigente **THEN** o sistema **SHALL** mostrar estado vazio explícito, sem sugerir que os Ministérios não existem globalmente.
3. **WHEN** Líder abre um Ministério concedido **THEN** o sistema **SHALL** permitir consulta dos participantes atuais e históricos conforme RF-ACS-008.
4. **WHEN** Líder tenta abrir Pessoa sem vínculo atual ou histórico com Ministério concedido **THEN** o sistema **SHALL** negar a consulta antes de expor dados.
5. **WHEN** o escopo usado numa listagem ou detalhe é revogado **THEN** acessos futuros **SHALL** ser negados, preservando os registros e autoria existentes.

### P1 — Administrar concessões e revogações

Como Administrador, quero configurar o acesso de cada Líder a Ministérios explicitamente.

1. **WHEN** Administrador concede acesso a uma conta Líder e Ministério ativo **THEN** o sistema **SHALL** persistir o escopo e permitir que o Líder veja esse Ministério.
2. **WHEN** Administrador revoga acesso vigente **THEN** o sistema **SHALL** impedir novas consultas e operações no escopo, sem excluir registros existentes.
3. **WHEN** ator que não é Administrador tenta conceder ou revogar escopo **THEN** o sistema **SHALL** negar a ação no servidor.
4. **WHEN** uma tentativa usa conta inexistente, não Líder ou Ministério arquivado **THEN** o sistema **SHALL** rejeitar a operação sem criar acesso parcial.
5. **WHEN** uma concessão ou revogação é bem-sucedida **THEN** o sistema **SHALL** registrar autor, alvo, Ministério, ação, data/hora e valores anteriores/posteriores aplicáveis.
6. **WHEN** Administrador altera ou reabre a configuração de uma conta **THEN** o sistema **SHALL** mostrar somente os acessos vigentes como concedidos e identificar acessos revogados no histórico, se exibidos.

**Teste independente:** conceder um Ministério QA a um Líder, confirmar lista/detalhe; revogar, confirmar negação futura; auditar as duas mudanças.

### P1 — Visitante rápido na frequência

Como Líder autorizado no encontro, quero registrar visitante somente dentro do fluxo de frequência para incluir a presença sem receber gestão geral de Pessoas.

1. **WHEN** Líder com acesso vigente abre frequência do encontro e informa somente nome completo no visitante rápido **THEN** o sistema **SHALL** criar Pessoa com status visitante e associar sua presença inicial `não confirmado` àquele encontro.
2. **WHEN** cadastro contextual é concluído **THEN** o sistema **SHALL** mostrar o visitante na lista e registrar a criação da Pessoa, presença e timeline conforme RF-PES-001/RF-ENC-004.
3. **WHEN** Líder tenta criar visitante fora do fluxo de frequência ou alterar cadastro fora do escopo permitido **THEN** o sistema **SHALL** negar a ação; esta decisão não concede gestão geral de Pessoas.
4. **WHEN** Líder não tem acesso vigente ao encontro **THEN** o sistema **SHALL** negar o cadastro antes de criar Pessoa ou presença.
5. **WHEN** a tentativa falha entre criação da Pessoa e associação da presença **THEN** o sistema **SHALL** evitar registro parcial órfão ou oferecer retentativa segura sem duplicar Pessoa/presença.

**Teste independente:** Líder com escopo cria visitante QA diretamente na frequência de encontro permitido; confirmar presença inicial e timeline, depois provar que o mesmo ator não pode usar a ação fora daquele encontro nem acessar Pessoa fora do limite de escopo.

## Casos de borda

- Uma conta pode receber vários Ministérios; a mesma Pessoa pode ter acesso mesmo sem ser líder ministerial.
- Conceder acesso a Ministério arquivado deve ser recusado.
- Repetir grant/revoke deve resultar em estado consistente, sem acessos duplicados ou restauração acidental.
- Conta desativada não opera mesmo quando tem escopo cadastrado.
- Resultado vazio por falta de escopo não deve ser confundido com ausência global de cadastro.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| LEAD-01 | RF-ACS-008/009 | Consulta 1–5 | Implemented; integration and Admin/Leader E2E passed |
| LEAD-02 | RF-ACS-009, RNF-005 | Administração 1–6 | Implemented; integration and Admin/Leader E2E passed |
| LEAD-03 | RF-ENC-004, RF-ACS-008, RF-PES-001, RF-TIM-001 | Visitante rápido 1–5 | Implemented; integration and Admin/Leader E2E passed; contextual rule confirmed by user |

**Cobertura:** 3 requisitos mapeados; regra de produto para visitante rápido confirmada.

## Sucesso

- [x] O líder concedido vê o ministério permitido e não vê dados fora do escopo.
- [x] Grant e revoke funcionam pela interface e ficam auditados.
- [x] Revogar acesso não remove histórico nem autoria anterior.
