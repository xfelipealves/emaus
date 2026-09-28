# Categorias e séries de encontros — especificação

**Status:** Draft para revisão; o E2E confirmou encontro avulso, mas não encontrou interface para categoria ou recorrência.

## Problema

O formulário de encontro permite selecionar categoria existente e criar encontro avulso. Os requisitos aprovados também pedem categorias personalizáveis e séries recorrentes, e a decisão AD-006 restringe a recorrência inicial a padrões usuais; esses recursos não aparecem na interface.

## Objetivos

- [ ] Permitir ao Administrador criar categorias customizadas e usá-las em encontros.
- [ ] Permitir criar séries semanais, quinzenais e mensais com dias selecionados e término opcional.
- [ ] Manter cada ocorrência independente para edição/cancelamento individual.
- [ ] Preservar a criação existente de encontros avulsos e a definição de público/estado.

## Fora de escopo

| Item | Motivo |
|---|---|
| Linguagem de recorrência livre | AD-006 limita os padrões iniciais a semanal, quinzenal e mensal. |
| Cargos ou eventos de calendário avançados | Não são parte de RF-ENC-001/002. |
| Categorias sugeridas como catálogo obrigatório | Os exemplos do RF-ENC-001 são ilustrativos; a igreja personaliza seu conjunto. |

## Premissas e decisões pendentes

| Tema | Padrão | Racional | Confirmado? |
|---|---|---|---|
| Quem administra categoria/série | Administrador | RF-ENC-001/002 e serviços atuais restringem gestão. | Sim. |
| Ocorrências | Encontros individuais, editáveis/canceláveis sem alterar a série ou outras ocorrências | RF-ENC-002 e spec do MVP. | Sim. |
| Padrões iniciais | Semanal, quinzenal e mensal; dias da semana; fim opcional | AD-006. | Sim. |
| Semântica de mensal | Mantém-se aberta a regra exata de contagem/posição de semana e datas de ocorrência | O requisito não define como posicionar ocorrência mensal. | Não; fechar no design. |
| Geração de horizonte | Manter mecanismo de geração existente; horizonte e política de repetição ficam para design | Código já possui serviço de geração, mas o usuário não definiu janela de geração. | Não. |

**Questões em aberto:** definir regra mensal (ex.: dia numérico, semana/dia ou datas selecionadas) e horizonte/idempotência de geração, sem ampliar a lista de padrões aprovada.

## Histórias e critérios de aceite

### P1 — Administrar categorias

Como Administrador, quero criar categorias customizadas para classificar os encontros da igreja.

1. **WHEN** Administrador cria categoria com nome não vazio **THEN** o sistema **SHALL** persistir e disponibilizar a categoria na criação de encontro.
2. **WHEN** Administrador cria categoria com nome vazio **THEN** o sistema **SHALL** rejeitar a operação sem criar registro.
3. **WHEN** Secretaria ou Líder tenta criar categoria **THEN** o sistema **SHALL** negar a operação no servidor.
4. **WHEN** encontro é criado com categoria existente **THEN** o sistema **SHALL** manter a associação ao encontro individual.

**Teste independente:** criar uma categoria QA como Administrador, usá-la num encontro avulso e confirmar persistência; tentar criar categoria com outro perfil e receber negação.

### P1 — Criar e operar séries recorrentes

Como Administrador, quero criar uma série recorrente para gerar encontros individuais sem perder a possibilidade de exceções.

1. **WHEN** Administrador cria série com nome, categoria, padrão permitido, ao menos um dia válido e data inicial **THEN** o sistema **SHALL** aceitar configuração válida.
2. **WHEN** a série tem término opcional **THEN** ocorrências **SHALL** ser geradas somente até a data de término inclusiva; sem término, geração respeita o horizonte definido no design.
3. **WHEN** uma ocorrência é editada **THEN** o sistema **SHALL** alterar apenas aquele encontro individual e preservar as demais ocorrências e a regra da série.
4. **WHEN** uma ocorrência é cancelada **THEN** o sistema **SHALL** preservá-la para consulta e impedir novos lançamentos de frequência nela.
5. **WHEN** configuração de série tem data final anterior à inicial, nenhum dia, dia fora do domínio ou categoria inexistente **THEN** o sistema **SHALL** rejeitar sem persistência parcial.
6. **WHEN** geração da mesma série/horizonte é repetida **THEN** o sistema **SHALL** evitar ocorrências duplicadas.
7. **WHEN** Secretaria ou Líder tenta gerir série **THEN** o sistema **SHALL** negar essa ação; Líder pode continuar criando encontro avulso no escopo permitido conforme RF-ACS-008.

**Teste independente:** criar série QA, gerar ocorrências, alterar/cancelar uma ocorrência e confirmar que as outras ocorrências e a série permanecem inalteradas.

### P1 — Preservar encontro avulso e público

1. **WHEN** usuário autorizado cria encontro avulso **THEN** o sistema **SHALL** permitir público de toda a igreja ou Ministérios selecionados e estado rascunho/agendado/cancelado.
2. **WHEN** reunião envolve um Ministério **THEN** Líder sem acesso a esse Ministério **SHALL** não conseguir listar/alterar seu encontro.
3. **WHEN** horários são exibidos ou persistidos **THEN** o sistema **SHALL** usar `America/Sao_Paulo`.

## Casos de borda

- Série sem ocorrências no intervalo selecionado mostra estado vazio sem erro.
- Ocorrência cancelada permanece no histórico e não aceita presença.
- Categoria não existente deve gerar erro contextual sem criar encontro parcialmente.
- Mudança na regra da série não reescreve ocorrências já editadas individualmente.
- Datas de começo/fim seguem o fuso definido em RNF-003.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| MEET-01 | RF-ENC-001 | Categorias 1–4 | Draft |
| MEET-02 | RF-ENC-002, AD-006 | Séries 1–7 | Draft |
| MEET-03 | RF-ENC-003, RF-ACS-006/008 | Encontro/público 1–2 | Draft |
| MEET-04 | RNF-003, spec MVP | Encontro/público 3 e casos de borda | Draft |

**Cobertura:** 4 requisitos mapeados; regras mensais e horizonte ficam para design.

## Sucesso

- [ ] Administrador cria categoria e série pela interface.
- [ ] Ocorrências podem ser editadas/canceladas individualmente sem alterar as demais.
- [ ] Encontro avulso e matriz de público/permissão continuam funcionando.
