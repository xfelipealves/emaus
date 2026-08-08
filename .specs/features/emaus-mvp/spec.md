# Emaús MVP Specification

**Status:** Approved — consolidated from approved product, design and architecture documents.

## Problem Statement

A igreja hoje depende de planilhas, listas e anotações dispersas para saber quem participa da comunidade, em quais ministérios e encontros, e qual é seu histórico. O Emaús será a fonte única para cadastro, acompanhamento e frequência, preservando fatos históricos e autoria de alterações.

## Goals

- [ ] Permitir que uma igreja de até 500 pessoas e 20 usuários simultâneos opere cadastro e frequência sem controles paralelos.
- [ ] Permitir que usuários autorizados encontrem uma pessoa, entendam seu histórico e registrem participação em poucos toques.
- [ ] Preservar histórico, autoria e auditoria em alterações sensíveis.

## Out of Scope

| Feature | Reason |
| --- | --- |
| PWA, modo offline e aplicativo nativo | MVP exige internet e foca em aplicação web responsiva. |
| WhatsApp, mensagens, chatbot e automações | Não fazem parte do problema operacional inicial. |
| Financeiro, dízimos e doações | Domínio fora do escopo. |
| QR Code, reconhecimento facial e analytics avançado | Aumentam complexidade sem serem necessários para a operação básica. |
| Upload de foto | Campo existe no modelo, mas o primeiro corte técnico usará iniciais. |
| Multi-igreja e filiais | O MVP atende uma única igreja. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Idade | Calculada da data de nascimento; nunca persistida separadamente. | Evita dado desatualizado. | Sim |
| E-mail | Obrigatório somente na Conta interna; Pessoa comum não precisa dele. | Cadastro de visitante deve ser rápido. | Sim |
| Conta por pessoa | No máximo uma conta interna para cada Pessoa. | Mantém autoria e permissões confiáveis. | Sim |
| Foto | Uma foto opcional e substituível; sem upload no primeiro corte técnico. | Mantém o modelo pronto e reduz escopo inicial. | Sim |
| Lista elegível de presença | Calculada pelos vínculos ministeriais atuais ao abrir a frequência. | Decisão explícita de produto. | Sim |
| Estado inicial de presença | Criar registro `nao_confirmado` para cada pessoa exibida. | Auditoria e resumo consistentes. | Sim |
| Nota editada | Cada edição cria uma versão completa. | Histórico de acompanhamento preservado. | Sim |
| Série recorrente | Série gera ocorrências independentes, editáveis/canceláveis individualmente. | Permite exceções sem alterar a regra inteira. | Sim |
| Estado de encontro | `rascunho`, `agendado` ou `cancelado`; encontros passados continuam consultáveis. | Não requer fechamento manual. | Sim |
| Motivo de correção de presença | Opcional; a auditoria sempre guarda antes/depois, autor e horário. | Não trava o lançamento rápido, mas permite contexto adicional quando necessário. | Sim |
| Regras de recorrência iniciais | Semanal, quinzenal e mensal, com dias da semana selecionáveis e fim opcional. | Cobre programações usuais sem exigir regra de recorrência completamente livre. | Sim |
| Testes | A estratégia será definida após as primeiras telas funcionais, antes de validar o MVP localmente. | Decisão de produto já registrada. | Sim |

**Open questions:** nenhuma — todas foram resolvidas ou registradas nesta especificação.

---

## User Stories

### P1: Acesso interno e autorização ⭐ MVP

**User Story:** Como administrador, quero criar e gerenciar contas internas vinculadas a Pessoas para que a equipe autorizada opere o sistema com permissões rastreáveis.

**Acceptance Criteria:**

1. WHEN uma conta ativa informa nome de usuário e senha válidos THEN o sistema SHALL iniciar sessão segura.
2. WHEN uma conta desativada tenta entrar THEN o sistema SHALL negar acesso sem criar sessão.
3. WHEN um administrador cria uma conta THEN o sistema SHALL exigir uma Pessoa existente, nome de usuário único, e-mail único e papel.
4. WHEN secretaria, líder ou administrador tenta uma ação THEN o sistema SHALL autorizar no servidor conforme papel e escopo ministerial.
5. WHEN um administrador desativa uma conta THEN o sistema SHALL preservar autoria histórica e impedir novos logins.

**Independent Test:** criar uma Pessoa e Conta ativa, entrar; desativar a mesma Conta e comprovar que o login deixa de funcionar.

### P1: Cadastro e acompanhamento de Pessoas ⭐ MVP

**User Story:** Como secretaria ou administrador, quero cadastrar e acompanhar Pessoas para manter uma base confiável da comunidade.

**Acceptance Criteria:**

1. WHEN o usuário cadastra um visitante THEN o sistema SHALL exigir somente nome completo, criar status `visitante` e registrar o evento na timeline.
2. WHEN o usuário promove visitante a membro THEN o sistema SHALL exigir telefone e data de nascimento, permitir ajustar a data efetiva e preservar o histórico anterior.
3. WHEN o usuário inativa uma Pessoa THEN o sistema SHALL preservar perfil, vínculos, presenças e timeline; não haverá exclusão física.
4. WHEN a data de nascimento existe THEN o sistema SHALL exibir idade calculada; WHEN não existe THEN não SHALL inventar idade.
5. WHEN um usuário cadastra ou altera uma Pessoa THEN o sistema SHALL retornar ao perfil com confirmação discreta.

**Independent Test:** cadastrar visitante, promovê-lo a membro e inativá-lo; confirmar que todos os eventos e registros anteriores continuam consultáveis.

### P1: Ministérios e vínculos históricos ⭐ MVP

**User Story:** Como administrador, quero administrar ministérios e vínculos de Pessoas para acompanhar participação atual e histórica.

**Acceptance Criteria:**

1. WHEN administrador cria, edita ou arquiva um Ministério THEN o sistema SHALL permitir a ação e auditar a alteração.
2. WHEN um Ministério é arquivado THEN o sistema SHALL manter histórico, impedir novos vínculos e impedir novos lançamentos de presença nesse Ministério.
3. WHEN administrador vincula uma Pessoa a um Ministério THEN o sistema SHALL registrar entrada, cargo `lider` ou `membro` e permitir data efetiva ajustável.
4. WHEN um vínculo recebe data de saída THEN o sistema SHALL preservá-lo no histórico e registrar o evento na timeline.
5. WHEN líder possui escopo concedido THEN o sistema SHALL limitar consultas e operações aos Ministérios autorizados, incluindo participantes atuais e antigos.

**Independent Test:** criar Ministério, vincular uma Pessoa, encerrar o vínculo e consultar o histórico da Pessoa e do Ministério.

### P1: Encontros e frequência ⭐ MVP

**User Story:** Como usuário com acesso ao encontro, quero criar encontros e lançar frequência rapidamente para registrar participação sem planilhas.

**Acceptance Criteria:**

1. WHEN administrador cria categoria ou série recorrente semanal, quinzenal ou mensal THEN o sistema SHALL permitir selecionar dias da semana, definir término opcional e editar ocorrências individuais sem alterar as demais.
2. WHEN usuário cria encontro THEN o sistema SHALL permitir público de toda a igreja ou de Ministérios selecionados e estado rascunho/agendado/cancelado.
3. WHEN a frequência é aberta THEN o sistema SHALL calcular elegíveis pelos vínculos atuais e criar estado `nao_confirmado` para cada Pessoa exibida.
4. WHEN o usuário toca uma linha de Pessoa THEN o sistema SHALL alternar `nao_confirmado → presente → ausente → nao_confirmado`, persistindo cada alteração imediatamente e exibindo retorno discreto.
5. WHEN usuário pesquisa ou adiciona visitante rápido THEN o sistema SHALL permitir registrar presença sem sair do fluxo.
6. WHEN presença é alterada depois do lançamento THEN o sistema SHALL registrar valor anterior, posterior, autor, data/hora e motivo opcional, além de atualizar a timeline da Pessoa.

**Independent Test:** criar encontro, lançar os três estados para Pessoas, corrigir uma presença e verificar auditoria e timeline.

### P1: Perfil, timeline e notas ⭐ MVP

**User Story:** Como usuário autorizado, quero consultar o perfil e a timeline de uma Pessoa para entender seu relacionamento com a igreja.

**Acceptance Criteria:**

1. WHEN o perfil é aberto THEN o sistema SHALL mostrar dados essenciais, status, idade quando disponível, Ministérios, frequência e timeline em ordem decrescente.
2. WHEN eventos de cadastro, status, vínculo, presença, correção ou nota acontecem THEN o sistema SHALL criar eventos de timeline consultáveis por tipo.
3. WHEN usuário cria, edita ou arquiva nota THEN o sistema SHALL registrar autor, datas e versões completas de edição.
4. WHEN uma nota é arquivada THEN o sistema SHALL ocultá-la por padrão e mostrá-la somente com filtro explícito.
5. WHEN usuário sem permissão consulta uma Pessoa THEN o sistema SHALL negar acesso antes de expor perfil, notas ou timeline.

**Independent Test:** criar Pessoa, adicionar/editar/arquivar nota e verificar versão, timeline e filtro de arquivadas.

### P1: Auditoria e operação segura ⭐ MVP

**User Story:** Como administrador, quero rastrear ações sensíveis para corrigir dados com confiança.

**Acceptance Criteria:**

1. WHEN uma ação sensível ocorre THEN o sistema SHALL registrar autor, data/hora, entidade, ação e valores antes/depois quando aplicável.
2. WHEN um salvamento automático falha THEN o sistema SHALL manter o estado visual anterior e mostrar erro contextual com opção de tentar novamente.
3. WHEN a ação é inativar, arquivar, cancelar ou desativar THEN o sistema SHALL pedir confirmação explícita.
4. WHEN o sistema é usado em desktop ou celular THEN fluxos de cadastro e frequência SHALL permanecer utilizáveis com conexão à internet.
5. WHEN datas e horários são exibidos ou persistidos THEN o sistema SHALL usar `America/Sao_Paulo`.

**Independent Test:** alterar presença e inativar Pessoa; verificar auditoria e confirmação de ação sensível.

---

## Edge Cases

- WHEN promoção a membro não possuir telefone ou data de nascimento THEN o sistema SHALL bloquear somente a promoção e informar os campos necessários.
- WHEN nome duplicado for cadastrado THEN o sistema SHALL permitir o cadastro, sem alerta de duplicidade no MVP.
- WHEN um líder tentar acessar Pessoa sem vínculo atual ou histórico em Ministério concedido THEN o sistema SHALL negar a consulta.
- WHEN conexão falhar durante persistência de presença THEN o sistema SHALL informar falha e permitir nova tentativa sem representar o estado como salvo.
- WHEN uma série tiver ocorrência cancelada THEN o sistema SHALL manter a ocorrência para consulta, sem permitir lançamento novo de presença.
- WHEN uma conta for desativada THEN o sistema SHALL preservar suas referências em notas, auditorias e correções.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AUTH-01 | Acesso interno e autorização | Tasks | Implemented in T12 |
| AUTH-02 | Acesso interno e autorização | Tasks | Implemented in T14 |
| PES-01 | Cadastro e acompanhamento de Pessoas | Tasks | Implemented in T17; list/search in T19; profile in T20 |
| PES-02 | Cadastro e acompanhamento de Pessoas | Tasks | Implemented in T18 |
| MIN-01 | Ministérios e vínculos históricos | Tasks | Implemented in T07 and T21 |
| MIN-02 | Ministérios e vínculos históricos | Tasks | Implemented in T07 |
| ENC-01 | Encontros e frequência | Tasks | Implemented in T08 |
| ENC-02 | Encontros e frequência | Tasks | Pending |
| TIM-01 | Perfil, timeline e notas | Tasks | Implemented in T09 |
| AUD-01 | Auditoria e operação segura | Tasks | Implemented in T09 |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] Um administrador consegue operar conta, pessoa, ministério, encontro e frequência sem planilha paralela.
- [ ] A frequência de um encontro pode ser lançada e corrigida em celular ou desktop, com auditoria.
- [ ] O perfil de uma Pessoa reúne status, vínculos, notas e frequência histórica autorizada.
- [ ] Todas as ações sensíveis especificadas preservam autoria e horário.
