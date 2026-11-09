# Ciclo de vida e histórico de Pessoas — especificação

**Status:** In Progress — escopo confirmado para implementação pela coordenação.

## Problema

O cadastro rápido e a inativação já funcionam, mas o formulário de promoção não inicia com a data local de hoje e os testes não comprovam a integridade de todos os dados históricos durante uma promoção/inativação. O perfil já contém um link para a timeline, porém falta cobertura do caminho de navegação, do acesso direto por escopo e do filtro que reúne cadastro e mudanças de status.

## Objetivos

- [ ] Permitir cadastro de visitante sem telefone/nascimento e completar promoção com dados obrigatórios e data local correta.
- [ ] Preservar perfil, vínculos, notas, presenças e eventos ao inativar uma Pessoa.
- [ ] Abrir a timeline pela aba do perfil, aplicar filtros completos e negar consulta fora do escopo.

## Fora de escopo

| Item | Motivo |
|---|---|
| Alertas de duplicidade no cadastro rápido | RF-PES-001 dispensa alerta no MVP. |
| Exclusão física de Pessoas | RF-PES-003 proíbe excluir definitivamente no MVP. |
| Campos adicionais de membro | Não aprovados para esta frente. |
| Upload e armazenamento de foto | AD-011 mantém foto opcional no MVP, entregue pela frente dedicada `emaus-profile-photo-upload`; este fluxo só preserva o perfil existente e usa iniciais enquanto a frente de foto não estiver implementada. |
| Alterações em frequência/quadro/auditoria de frequência | Pertencem à frente de confiabilidade de frequência. |

## Premissas e decisões

| Tema | Decisão | Racional | Confirmado? |
|---|---|---|---|
| Promoção | Telefone e nascimento são obrigatórios; a data efetiva começa no dia atual em `America/Sao_Paulo` e pode ser editada. | RF-PES-002. | Sim |
| Inativação | A data efetiva informada deve ser preservada; perfil e dados relacionados permanecem. | RF-PES-003. | Sim |
| Filtro `Status` | Agrupa eventos `STATUS` e `REGISTRATION`; os demais filtros correspondem a ministérios, frequência, notas e correções. | A fonte requer filtros por status/cadastro e o projeto já apresenta uma opção `Status`. | Sim |
| Nota arquivada | O filtro explícito `Arquivadas` consulta o conteúdo atual; autoria e todas as versões permanecem persistidas. | RF-TIM-004; a interface de histórico de versões é fora de escopo. | Sim |
| Datas efetivas | Datas de calendário são interpretadas e exibidas no fuso `America/Sao_Paulo`, sem deslocar o dia escolhido. | RNF-003. | Sim |
| Autorização | Administrador/Secretaria gerenciam status; consultas de perfil/timeline obedecem aos escopos existentes. | RF-ACS-007/008. | Sim |

**Questões em aberto:** nenhuma decisão funcional pendente para esta entrega.

## Histórias e critérios de aceite

### P1 — Cadastrar, promover e inativar com histórico

**PERS-01 — Cadastro de visitante**

1. **WHEN** Secretaria ou Administrador cadastra uma Pessoa com nome completo e telefone/nascimento vazios **THEN** o sistema **SHALL** criar a Pessoa como `VISITOR`, manter esses campos vazios e registrar o evento `REGISTRATION` “Pessoa cadastrada” na timeline.

**PERS-02 — Promoção a membro**

1. **WHEN** Secretaria ou Administrador abre a ação de promoção para uma Pessoa `VISITOR` **THEN** o sistema **SHALL** preencher a data efetiva com o dia atual em `America/Sao_Paulo` e permitir que o usuário a altere.
2. **WHEN** a promoção é enviada com telefone e nascimento válidos **THEN** o sistema **SHALL** salvar `MEMBER`, os dados obrigatórios e a data efetiva escolhida, preservando o dia do calendário local.
3. **WHEN** telefone ou nascimento está vazio **THEN** o sistema **SHALL** impedir apenas a promoção, indicar qual campo é necessário e manter status, telefone, nascimento e eventos existentes sem alteração.
4. **WHEN** a promoção é concluída **THEN** o sistema **SHALL** acrescentar um evento de status com a data efetiva e manter eventos anteriores; status, evento e auditoria **SHALL** ser persistidos na mesma transação.

**PERS-03 — Inativação**

1. **WHEN** Secretaria ou Administrador inativa uma Pessoa ativa e informa a data efetiva **THEN** o sistema **SHALL** persistir `INACTIVE` e a data escolhida sem exclusão física.
2. **WHEN** a Pessoa é inativada **THEN** o sistema **SHALL** manter seu perfil, vínculos, notas, versões de notas, presenças e timeline consultáveis, acrescentando evento e auditoria de status na mesma transação.

**Teste independente:** cadastrar visitante sem telefone/nascimento; verificar data de promoção inicialmente preenchida com hoje local, bloquear cada campo ausente sem mudar o registro, promover após editar a data e conferir status/dados/timeline após recarga; adicionar nota, vínculo e presença, inativar com data editada e conferir a preservação no perfil e timeline após recarga.

### P1 — Navegar e consultar timeline

**PERS-04 — Timeline e notas arquivadas**

1. **WHEN** usuário autorizado ativa a aba Timeline do perfil **THEN** o sistema **SHALL** abrir `/pessoas/{id}/timeline` para a mesma Pessoa.
2. **WHEN** timeline autorizada é aberta **THEN** o sistema **SHALL** mostrar eventos daquela Pessoa do mais recente para o mais antigo e fornecer filtros `Status` (cadastro e status), `Ministérios`, `Frequência`, `Notas` e `Correções`.
3. **WHEN** uma nota é arquivada **THEN** o sistema **SHALL** ocultá-la da lista padrão de notas do perfil e mostrá-la mediante o filtro explícito `Arquivadas`, preservando autoria e todas as versões.

**PERS-05 — Autorização e datas locais**

1. **WHEN** usuário autenticado sem escopo tenta abrir diretamente perfil ou timeline de uma Pessoa **THEN** o sistema **SHALL** negar a consulta sem expor eventos nem notas.
2. **WHEN** usuário autorizado escolhe uma data efetiva para promoção ou inativação **THEN** o sistema **SHALL** persistir e apresentar o mesmo dia de calendário em `America/Sao_Paulo`.

**Teste independente:** abrir timeline pela aba e pela URL direta com um usuário autorizado e outro fora do escopo; conferir os filtros, a ordem dos eventos e a consulta da nota arquivada sem perda de autoria/versões.

## Casos de borda

- Nome duplicado continua permitido no cadastro rápido.
- Nascimento ausente não gera idade inventada.
- Promoção sem qualquer um dos dois campos obrigatórios não altera os dados previamente salvos.
- Falha na mudança de status não pode deixar status, timeline e auditoria divergentes.
- Nota arquivada permanece consultável e conserva autoria/versões.
- Pessoa inativa conserva registros históricos e seu acesso continua submetido à autorização existente.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| PERS-01 | RF-PES-001 | Cadastro de visitante | Implementing |
| PERS-02 | RF-PES-002 | Promoção e validação | Implementing |
| PERS-03 | RF-PES-003 | Inativação e preservação | Implementing |
| PERS-04 | RF-PES-005, RF-TIM-001/002/004 | Timeline, filtros e arquivo de notas | Implementing |
| PERS-05 | RF-ACS-007/008, RNF-003 | Acesso e datas locais | Implementing |

**Cobertura:** 5 requisitos; todos mapeados em `tasks.md`.

## Sucesso

- [ ] Cadastro de visitante sem telefone/nascimento é possível; promoção valida os campos e persiste a data efetiva local selecionada.
- [ ] Inativação conserva os dados relacionados e cria histórico consistente.
- [ ] Aba e URL direta consultam a mesma timeline segundo os escopos autorizados.
- [ ] Os filtros exibem cadastro/status e cada uma das categorias solicitadas.
