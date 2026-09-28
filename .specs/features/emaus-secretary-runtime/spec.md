# Estabilidade dos módulos para Secretaria — especificação

**Status:** Draft para revisão; escopo limitado à exceção de cliente observada no E2E.

## Problema

Na sessão Secretaria, `/encontros`, `/ministerios` e `/atividades` mostraram exceção de cliente após recarga; a rota de frequência do encontro também falhou. O mesmo ambiente abriu encontros e atividades para Administrador. O erro bloqueou operações que RF-ACS-007 e a especificação ACT disponibilizam à Secretaria/usuários ativos.

## Objetivos

- [ ] Renderizar as rotas autorizadas sem exceção de cliente para uma sessão ativa de Secretaria.
- [ ] Preservar os limites do papel, sem adicionar controles administrativos.
- [ ] Apresentar erros de servidor e estados sem dados de forma controlada, sem falha total da página.

## Fora de escopo

| Item | Motivo |
|---|---|
| Conceder à Secretaria gestão de ministérios ou contas | RF-ACS-007 proíbe essas operações. |
| Alterar a política de escopo de Ministérios | A listagem para Secretaria não está especificada com detalhe suficiente; este documento exige resposta controlada e segura, sem definir novos dados visíveis. |
| Refatorar visual das páginas | A frente corrige estabilidade e autorização observada. |

## Premissas e questões

| Tema | Padrão | Racional | Confirmado? |
|---|---|---|---|
| Rotas expostas no menu | Não podem quebrar a aplicação; devem renderizar conteúdo permitido ou negação controlada | Uma sessão válida não deve produzir tela de erro de cliente. | Derivado de qualidade; comportamento exato de `/ministerios` depende da política de leitura. |
| Atividades | Usuário ativo/autorizado pode consultar e editar a lista compartilhada | Decisão explícita em `emaus-activities/spec.md`. | Sim. |
| Encontros e frequência | Secretaria opera frequência em qualquer encontro | RF-ACS-007. | Sim. |
| Diagnóstico | Reproduzir com mesma conta, rota e ação, registrando erro sem dados pessoais desnecessários | Necessário para distinguir erro de renderização de autorização. | Proposta de validação. |

**Questão em aberto:** a permissão de consulta à lista de ministérios pela Secretaria deve seguir a navegação atual ou ser negada? A especificação não amplia a permissão: qualquer resultado deve respeitar a regra de negócio e evitar exceção de cliente.

## Histórias e critérios de aceite

### P1 — Operar encontros sem falha de cliente

1. **WHEN** Secretaria autenticada abre `/encontros` **THEN** o sistema **SHALL** renderizar a agenda ou estado vazio válido, sem exceção de cliente.
2. **WHEN** Secretaria abre um encontro autorizado **THEN** o sistema **SHALL** renderizar a frequência e permitir lançamento/correção de acordo com RF-ACS-007.
3. **WHEN** uma solicitação de frequência é negada ou falha no servidor **THEN** o sistema **SHALL** mostrar erro contextual e manter a página funcional, sem representar estado não salvo como concluído.

### P1 — Acessar atividades compartilhadas sem falha

1. **WHEN** uma conta ativa de Secretaria abre `/atividades` **THEN** o sistema **SHALL** carregar as mesmas atividades compartilhadas acessíveis aos demais usuários ativos.
2. **WHEN** a Secretaria cria ou edita atividade/subtarefa autorizada **THEN** o sistema **SHALL** persistir e apresentar confirmação ou erro contextual segundo ACT-01 a ACT-07.

### P1 — Resposta segura na rota de Ministérios

1. **WHEN** Secretaria abre `/ministerios` **THEN** o sistema **SHALL** responder com uma página válida de leitura autorizada ou uma negação controlada, nunca com exceção de cliente.
2. **WHEN** Secretaria acessa uma ação administrativa de Ministério **THEN** o sistema **SHALL** negar a ação e não exibir formulário de criar, editar, arquivar ou gerenciar vínculos.
3. **WHEN** qualquer rota protegida encontra sessão ou dados inválidos **THEN** o sistema **SHALL** apresentar estado de erro seguro e registrar diagnóstico técnico suficiente para investigação.

**Teste independente:** entrar como Secretaria em sessão isolada; recarregar as três rotas, abrir um encontro, lançar presença QA e abrir a atividade QA; confirmar controles permitidos e negações sem acesso indevido.

## Casos de borda

- Sessão expirada deve redirecionar ou negar acesso de forma controlada, sem exception screen.
- Lista vazia, encontro cancelado e falha de ação devem ter estados explícitos.
- A falha em uma rota não deve corromper a navegação em outra.
- Renderizar estado seguro não concede permissões que RF-ACS-007 nega.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| SEC-RUN-01 | RF-ACS-007, RF-ENC-004/005 | Encontros 1–3 | Draft |
| SEC-RUN-02 | `.specs/features/emaus-activities/spec.md`, ACT-01 a ACT-07 | Atividades 1–2 | Draft |
| SEC-RUN-03 | RF-ACS-007 | Ministérios 1–3 | Draft |
| SEC-RUN-04 | RNF-005 | Resposta/diagnóstico seguro | Draft |

**Cobertura:** 4 itens rastreados; decisão de leitura de Ministério permanece aberta.

## Sucesso

- [ ] As falhas observadas deixam de reproduzir em sessão de Secretaria após reload.
- [ ] A Secretaria conclui frequência permitida e uso de atividades sem exceção de cliente.
- [ ] Rotas administrativas permanecem bloqueadas para Secretaria.
