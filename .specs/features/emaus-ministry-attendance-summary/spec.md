# Resumo de frequência por Ministério — especificação

**Status:** Draft para revisão; período, métricas e inclusão de encontros de toda a igreja escolhidos pelo usuário em 27/09/2026.

## Problema

RF-ENC-006 exige resumo de frequência por Ministério. O E2E encontrou histórico individual e resumo por encontro, mas não uma consulta agregada por Ministério. O requisito formal deixa período e métricas em aberto; o usuário definiu período selecionável e contagem de presente, ausente e não confirmado.

## Objetivos

- [ ] Consultar a frequência agregada por Ministério para um período escolhido.
- [ ] Exibir os três estados definidos para cada encontro elegível no resumo.
- [ ] Restringir a consulta ao escopo autorizado de cada papel.

## Fora de escopo

| Item | Motivo |
|---|---|
| Alertas de baixa frequência | RF-ENC-006 os exclui do MVP. |
| Dashboard analítico avançado | Excluído pelo requisito. |
| Ranking de pessoas ou recomendações pastorais | Não solicitado e não previsto nos requisitos. |

## Premissas e decisões pendentes

| Tema | Padrão | Racional | Confirmado? |
|---|---|---|---|
| Métricas | Contagem de presente, ausente e não confirmado | Escolha explícita do usuário, usando estados de RF-ENC-004. | Sim. |
| Período | O usuário seleciona o período consultado; se representado como intervalo por datas, início e fim são inclusivos | Concretiza a escolha explícita por período selecionável sem fixar ainda o controle de interface nem um período padrão. | Seleção confirmada; controle/padrão para design. |
| Fuso | Datas de encontro interpretadas em `America/Sao_Paulo` | RNF-003. | Sim. |
| Encontro cancelado | Ainda sem regra de inclusão no agregado | Encontro cancelado não aceita novos lançamentos, mas o histórico permanece consultável. A regra do relatório não está definida em RF-ENC-006. | Pendente para design. |
| Encontros de toda a igreja | Incluir em cada Ministério e contar a frequência de seus integrantes | Decisão explícita do usuário em 27/09/2026. O critério temporal para identificar vínculo histórico precisa seguir uma regra única e rastreável do domínio. | Sim, inclusão confirmada; temporalidade do vínculo pendente para design. |
| Período inicial | Sem valor padrão definido nesta fase | Não definido pelo usuário nem pelo requisito. | Não; design escolhe ou solicita decisão. |

**Questões para design:** definir se frequência registrada em encontros cancelados entra no agregado histórico e qual vigência do vínculo ministerial determina a atribuição dos membros em encontros de toda a igreja. A inclusão desses encontros em cada Ministério já está decidida.

## Histórias e critérios de aceite

### P1 — Consultar resumo de frequência por Ministério

Como usuário autorizado, quero consultar os estados de frequência no período escolhido para acompanhar a operação do Ministério.

1. **WHEN** usuário autorizado escolhe um Ministério e período válido **THEN** o sistema **SHALL** apresentar contagem separada de `presente`, `ausente` e `não confirmado` para o conjunto de encontros incluídos nesse Ministério e período.
2. **WHEN** o período inicial é posterior ao final ou contém data inválida **THEN** o sistema **SHALL** rejeitar a consulta com mensagem contextual e não retornar agregado enganoso.
3. **WHEN** não existem encontros/lançamentos elegíveis no período **THEN** o sistema **SHALL** mostrar contagens zero e estado vazio explícito.
4. **WHEN** usuário Líder consulta resumo **THEN** o sistema **SHALL** incluir somente Ministérios concedidos e ativos no escopo da conta.
5. **WHEN** Administrador consulta resumo **THEN** o sistema **SHALL** permitir consulta aos Ministérios disponíveis à administração.
6. **WHEN** Secretaria consulta resumo **THEN** o sistema **SHALL** respeitar a permissão de frequência estabelecida para qualquer encontro, sem exibir controles de administração de Ministério.
7. **WHEN** a frequência de um encontro muda **THEN** nova consulta **SHALL** refletir o estado persistido, sem contar a mesma presença duas vezes.
8. **WHEN** o relatório inclui datas **THEN** o sistema **SHALL** interpretar começo/fim e horários em `America/Sao_Paulo`.
9. **WHEN** um encontro de público `toda a igreja` está no período consultado **THEN** o sistema **SHALL** incluí-lo no agregado de cada Ministério e contar os estados de frequência de seus integrantes conforme a vigência de vínculo ministerial definida no domínio.
10. **WHEN** uma Pessoa está vinculada a mais de um Ministério conforme a vigência definida no domínio **THEN** o sistema **SHALL** considerar sua frequência em cada um desses Ministérios, sem duplicar a Pessoa dentro do mesmo Ministério e encontro.

**Teste independente:** preparar dois Ministérios QA e encontros com estados distintos em datas dentro/fora do intervalo, consultar como Admin e Líder com escopo limitado e comparar cada contagem com os registros individuais.

### P2 — Exportação

**Fora da entrega atual:** exportação não aparece em RF-ENC-006; não presumir CSV/PDF. Requer requisito separado se for desejada.

## Casos de borda

- Datas inicial/final inclusivas, mudanças de horário próximas à meia-noite e fuso local.
- Ministério sem encontro no período.
- Encontro com parte da frequência ainda não confirmada.
- Ministério arquivado deve permanecer consultável historicamente conforme autorização, sem permitir operações novas.
- Encontro de toda a igreja compõe o agregado de cada Ministério; a regra temporal que identifica seus integrantes deve ser consistente com a vigência histórica de vínculos.
- Frequência persistida em encontro cancelado pode ter valor histórico; sua inclusão no agregado requer decisão de design.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| MARS-01 | RF-ENC-006 | Resumo 1–3 e 7 | Draft |
| MARS-02 | RF-ACS-006/007/008/009 | Resumo 4–6 | Draft |
| MARS-03 | RF-ENC-003/004, RF-MIN-001/002, AD-004 | Atribuição de audiência, vínculo e estados | Inclusão confirmada; regra temporal em aberto |
| MARS-04 | RNF-003 | Resumo 8 | Draft |

**Cobertura:** 4 grupos de requisitos mapeados; inclusão de encontro de toda a igreja confirmada, com vigência temporal do vínculo e encontros cancelados a fechar no design.

## Sucesso

- [ ] Usuário recebe contagens reproduzíveis a partir das listas por encontro.
- [ ] Filtro por período inclui somente o intervalo escolhido.
- [ ] Líder não consulta Ministério fora do escopo.
- [ ] O relatório não transforma estados ainda não confirmados em presença/ausência.
- [ ] A mesma Pessoa pode aparecer nos agregados de mais de um Ministério se os vínculos válidos assim determinarem, sem duplicação no mesmo agregado.
