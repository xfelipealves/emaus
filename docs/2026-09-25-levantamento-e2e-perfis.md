# Levantamento E2E — perfis e lacunas do Emaús

## Identificação

- **Data:** 25/09/2026
- **Ambiente:** aplicação local em `http://127.0.0.1:3000`
- **Checkout:** branch `feat/emaus-shared-activities`, HEAD `abde34a5ff98481121cb8690f203544babe6706a`
- **Execução:** navegação manual real pela interface Orca, em sessões isoladas de Administrador, Secretaria e Líder.
- **Código:** nenhum código foi alterado por este levantamento. O checkout já tinha alterações locais antes dos testes; elas foram preservadas.
- **Automação:** a suíte Playwright não foi rodada porque `e2e/global-setup.ts:4-8` executa `prisma migrate reset --force`, o que apagaria dados do banco local. Os testes abaixo foram manuais.
- **Acesso:** os três perfis aceitaram a senha informada na conversa. O README, o seed e `e2e/demo-fixtures.ts` ainda documentam outra senha comum; alinhar a documentação/fixture ao ambiente usado. A senha não é reproduzida aqui.

## Síntese

Os três perfis autenticaram. Foram confirmados problemas que impedem ou degradam fluxos centrais: a interface não refletiu nem confirmou a alteração de frequência no caso QA do Administrador; a Secretaria recebeu exceção de cliente ao abrir encontros, ministérios e atividades; e a lista de ministérios do Líder veio vazia embora o detalhe do ministério concedido estivesse acessível.

Também há requisitos com serviço de domínio, mas sem fluxo de interface utilizável: vínculo de pessoas a ministérios, concessão de escopos, criação de categorias e séries recorrentes, recuperação de senha e resumo de frequência por ministério. Os achados abaixo separam falha reproduzida, ausência de tela, conflito de requisito e item não validado.

## Resultado por perfil

| Perfil | Passou | Falhou ou ficou bloqueado |
|---|---|---|
| **Administrador** | Login; cadastro rápido de pessoa; notas; inativação com histórico preservado; criação de encontro; criação/edição/arquivo de ministério QA; abertura de atividades; consulta de auditoria. | No encontro QA futuro, dois cliques de presença deixaram a interface e o histórico em “Não confirmado”; há um UPDATE de presença sem identificação do encontro/pessoa na auditoria, então a persistência desse teste não pôde ser atribuída. Criação de conta não foi concluída: o clique não gerou POST e a aba foi parar em `/ministerios`; não foi repetido para evitar duplicidade. |
| **Secretaria** | Login; visitante cadastrado só com nome; criar/editar/arquivar nota; inativar a pessoa QA e consultar a timeline direta; acesso às telas de usuários/auditoria foi corretamente negado. | `/ministerios`, `/encontros`, a frequência de um encontro e `/atividades` exibiram exceção de cliente após recarregar. O campo da data efetiva da promoção veio vazio. O link “Timeline” no perfil não navegou, embora a rota direta funcione. |
| **Líder** | Login; detalhe do ministério concedido com participantes atuais e históricos; pessoa fora do escopo retornou 404; criação de encontro no ministério concedido; atividade compartilhada e conclusão persistente de subtarefa. | `/ministerios` indicou que não havia ministérios. O cadastro rápido de visitante na frequência foi negado. A atividade QA foi excluída e a remoção da subtarefa persistiu; não foi possível verificar o cancelamento da confirmação de exclusão. |

## Cobertura consolidada dos requisitos

| Requisito | Resultado | Evidência/resumo |
|---|---|---|
| **RF-ACS-001 — autenticação** | Passou | Login nos três perfis. |
| **RF-ACS-003/005 — criar/desativar conta** | Não verificado | O formulário está disponível, mas o envio QA não gerou POST; nenhuma conta foi criada ou desativada nesta rodada. |
| **RF-ACS-004 — recuperação/redefinição** | Ausente | Não há fluxo na tela de login ou de contas. |
| **RF-ACS-006 — administrador** | Parcial | Cadastro/notas/inativação de pessoa, ministério QA e encontro QA testados; frequência e gestão de contas não foram concluídas. |
| **RF-ACS-007 — secretaria** | Parcial | Cadastro, nota e inativação passaram; exceção de cliente bloqueou ministérios, encontros/frequência e atividades. |
| **RF-ACS-008 — líder** | Parcial | Consulta dentro/fora do escopo foi testada; lista de ministérios falhou e visitante rápido foi negado. |
| **RF-ACS-009 — escopo por ministério** | Ausente na UI | Sem controles administrativos para conceder/revogar escopo. |
| **RF-PES-001 — cadastro rápido** | Passou | Visitantes QA criados somente com nome nos perfis Admin e Secretaria. |
| **RF-PES-002 — promoção** | Parcial | Obrigatoriedade de telefone/nascimento bloqueou submissão incompleta; data efetiva veio vazia e promoção não foi concluída. |
| **RF-PES-003 — inativação** | Passou | Pessoas QA inativadas; perfil, nota/frequência e timeline continuaram consultáveis. |
| **RF-PES-004 — foto** | Divergência de escopo | Requisito formal pede foto, especificação consolidada adia upload. |
| **RF-PES-005 / RF-TIM-002/004 — notas e timeline** | Passou parcialmente | Secretaria criou/editou/arquivou nota e consultou filtros/timeline direta; a aba do perfil não navegou. |
| **RF-MIN-001 — administrar ministério** | Passou | Admin criou, editou e arquivou um ministério QA; estado e auditoria persistiram. |
| **RF-MIN-002/003 — vínculos e cargos** | Ausente na UI | Sem ações para vincular/encerrar pessoa ou definir cargo. |
| **RF-ENC-001/002 — categorias e recorrência** | Ausente na UI | Encontro avulso disponível; criação de categoria e séries não aparecem na interface. |
| **RF-ENC-003 — público do encontro** | Passou parcialmente | Encontro QA do Líder criado para ministério concedido; outras combinações não verificadas. |
| **RF-ENC-004/005 — lançamento/correção de frequência** | Inconclusivo/falha observada | Admin não viu mudança no caso QA futuro; Secretaria bloqueada por exceção; Líder não alterou presenças seed. |
| **RF-ENC-006 — consultas de frequência** | Parcial | Histórico individual e lista por encontro existem; resumo por ministério não foi encontrado. |
| **Atividades compartilhadas — ACT-01 a ACT-07** | Parcial | Criação, conclusão de subtask e exclusão QA persistiram entre sessões; cancelamento da exclusão, buckets e uso pela Secretaria não foram validados. |
| **RNF-005 — auditoria** | Parcial | Pessoa, nota, ministério, encontro e atividade QA tiveram eventos visíveis; a alteração de frequência não pôde ser ligada a um registro específico. |
| **RNF-001/002/004 — capacidade, celular e backup** | Não avaliados | Fora dos cenários manuais desta rodada. |

## Falhas reproduzidas

### E2E-01 — Presença não foi confirmada no caso QA do Administrador — prioridade alta, repetição necessária

No encontro QA futuro criado pelo Administrador, a pessoa QA começou como “Não confirmado”. Após dois cliques em “Marcar”, a linha e o resumo continuaram sem mudança; não apareceu retorno de sucesso ou erro. Depois de recarregar, a tela e o histórico da pessoa ainda mostravam “Não confirmado”. A auditoria exibiu um UPDATE de frequência por “Administrador de Desenvolvimento”, mas não identificava pessoa nem encontro; não é possível atribuí-lo a esse teste. Nenhuma presença de pessoa semeada foi intencionalmente alterada.

Isso não atende visualmente ao lançamento descrito em RF-ENC-004 nem permite confirmar RF-ENC-005. A interface em `src/app/(dashboard)/encontros/[meetingId]/attendance-board.tsx:33-52` prevê atualização visual e retorno após a ação; o resultado real não confirmou salvamento. Como o encontro era futuro e o evento de auditoria não identifica o alvo, repetir com um encontro em andamento/passado antes de atribuir a causa a uma falha de persistência do serviço.

### E2E-02 — Exceção de cliente bloqueia módulos da Secretaria — prioridade alta

Na sessão de Secretaria, `/encontros/demo-meeting-scheduled` mostrou “Application error: a client-side exception has occurred while loading 127.0.0.1”. A falha persistiu após recarga e também apareceu em `/encontros`, `/ministerios` e `/atividades`. O console Orca não exibiu mensagem que identificasse a causa. O Administrador abriu `/encontros` e `/atividades` normalmente no mesmo ambiente.

O erro impediu validar frequência da Secretaria e o uso de atividades compartilhadas. As rotas administrativas `/configuracoes/usuarios` e `/configuracoes/auditoria` redirecionaram a Secretaria para `/`, comportamento esperado para esse papel.

### E2E-03 — Lista de ministérios vazia para Líder com acesso concedido — prioridade alta

O Líder abriu diretamente `/ministerios/demo-ministry-welcome` e consultou “Demo Acolhimento”, seus dois participantes atuais e uma pessoa histórica. A rota `/ministerios`, porém, mostrou “Nenhum Ministério cadastrado”.

Há uma causa provável no código: `src/app/(dashboard)/ministerios/page.tsx:14-15` monta o ator com `ministryAccess: []`; `listMinistries` filtra a lista pelos acessos ativos em `src/features/ministerios/ministry-service.ts:38-43`. O comportamento observado confirma a falha de listagem, embora a rota de detalhe do ministério permitido funcione.

### E2E-04 — Líder não consegue cadastrar visitante rápido na frequência — prioridade média, decisão de permissão necessária

No encontro QA do ministério concedido, o botão de cadastro rápido retornou “Você não tem permissão para gerenciar Pessoas”. RF-ENC-004 diz que um usuário com acesso ao encontro pode cadastrar um visitante rapidamente; RF-ACS-008 não concede explicitamente gestão geral de pessoas ao Líder. O requisito de frequência e a regra de papel precisam ser reconciliados, ou a implementação deve conceder uma permissão restrita para esse cadastro contextual.

Não foi criada pessoa por essa tentativa e nenhuma presença semeada foi alterada.

### E2E-05 — Navegação “Configurações” aponta para rota inexistente — prioridade média

O link global “Configurações” usa `/configuracoes` (`src/components/layout/navigation.tsx:22`), mas o checkout contém apenas páginas filhas, como `/configuracoes/usuarios` e `/configuracoes/auditoria`. A abertura direta de `/configuracoes` retorna 404. O link não fornece um destino utilizável aos perfis.

### E2E-06 — Aba “Timeline” não navega a partir do perfil — prioridade média, confirmar em nova sessão

Na sessão de Secretaria, clicar duas vezes em “Timeline” manteve o perfil aberto. A rota direta `/pessoas/<id>/timeline` funcionou e mostrou os eventos; o código da aba aponta para essa rota (`src/app/(dashboard)/pessoas/[personId]/page.tsx:82-85`). Registrar como falha de interação observada, com reteste recomendado para separar problema de navegador/acionamento de problema da aplicação.

### E2E-07 — Data efetiva da promoção vem vazia — prioridade média

Na tela de promoção da Secretaria, “Data efetiva da promoção” estava sem valor em 25/09/2026. RF-PES-002 determina preenchimento inicial com a data atual, permitindo ajuste. O campo é obrigatório, mas `src/app/(dashboard)/pessoas/[personId]/status-actions.tsx:20-28` não define valor padrão. A promoção completa não foi validada porque o formulário não permitiu concluir o preenchimento dos dados obrigatórios nessa sessão.

Na inativação, a data também começou vazia, mas RF-PES-003 exige apenas que seja ajustável. Tratar o preenchimento automático como melhoria de usabilidade, não como quebra comprovada desse requisito.

## Requisitos sem fluxo de interface identificado

| Requisito | Estado encontrado | Evidência/impacto |
|---|---|---|
| **RF-ACS-004 — recuperação/redefinição de senha** | Não implementado na interface observada. | Login só apresenta usuário e senha (`src/app/(auth)/login/page.tsx:22-34`); a tela administrativa de contas oferece criação e desativação, sem redefinição (`src/app/(dashboard)/configuracoes/usuarios/account-forms.tsx`). |
| **RF-ACS-009 — conceder/revogar escopo ministerial** | Não há controle na tela de usuários. | Há serviço `src/features/ministerios/access-scope-service.ts`, mas a criação de conta mostra apenas pessoa, login, e-mail, senha e papel. A tela não permite selecionar ministérios para um Líder. |
| **RF-MIN-002/003 — criar/encerrar vínculo e definir cargo** | Não há fluxo de interface localizado. | `membership-service.ts` implementa operações e auditoria; páginas de ministério exibem participantes, mas não oferecem vincular pessoa, data de início/fim ou mudar cargo. Isso impede a gestão requerida pelo Administrador. |
| **RF-ENC-001/002 — categorias e séries recorrentes** | Não há telas administrativas localizadas. | O formulário de novo encontro permite selecionar uma categoria existente e criar um encontro individual (`meeting-forms.tsx:19-30`). Existem serviços de categoria/série, mas a interface não oferece criação/gestão de categorias nem série recorrente. |
| **RF-ENC-006 — resumo de frequência por ministério** | Não há relatório por ministério na interface localizada. | Há resumo por encontro na tela de frequência e histórico individual no perfil; a consulta agregada por ministério não foi encontrada. |

## Divergências de escopo e itens não validados

- **RF-PES-004 — foto de perfil:** o requisito formal pede adicionar/atualizar foto; `.specs/features/emaus-mvp/spec.md:23,35` e a decisão AD-005 em `.specs/STATE.md` adiam explicitamente upload/armazenamento. Tratar como divergência documental de escopo, não como defeito inesperado do corte atual.
- **Auditoria:** a tela do Administrador mostrou eventos QA de criação de encontro, inativação de pessoa e operações da atividade/subtarefa, incluindo autor e valores antes/depois. Não foi possível verificar auditoria de presença porque o lançamento não persistiu.
- **Criação de conta:** permaneceu inconclusiva. A tentativa com pessoa QA não gerou POST; a aba mudou para `/ministerios`, e a conta não apareceu na lista após recarregar. Não houve segunda tentativa nem conta QA criada.
- **Atividade compartilhada:** o Líder marcou a subtarefa, clicou em Salvar, viu `1/1` e confirmou o estado após recarga. Depois, a atividade QA e sua subtarefa desapareceram após a ação de excluir e recarga. O cancelamento da confirmação não foi verificado.
- **Ministério QA:** o Administrador criou, editou a descrição e arquivou o ministério de teste. O estado e a descrição revisada persistiram após recarga; a auditoria mostrou autor e valores antes/depois.
- **Requisitos não funcionais:** não foram avaliados nesta rodada responsividade em celular, capacidade de 500 pessoas/20 sessões simultâneas nem backup semanal com retenção de 90 dias (RNF-001, RNF-002 e RNF-004).
- **Frequência:** correção auditável (RF-ENC-005) ficou bloqueada pelo não salvamento observado em E2E-01; a sessão da Secretaria também não alcançou o fluxo por E2E-02.

## Dados QA deixados no ambiente local

- Pessoas QA criadas para testar cadastro/notas foram inativadas; uma nota QA permanece arquivada. O histórico/timeline permaneceu visível.
- Encontros QA criados pelos perfis Administrador e Líder permanecem no ambiente. A tela e o histórico do encontro QA do Administrador continuaram em “Não confirmado”; o encontro do Líder não recebeu alteração de presença.
- O Ministério QA criado pelo Administrador foi arquivado e permanece no ambiente com a descrição revisada.
- A atividade e a subtarefa QA criadas para validar compartilhamento foram excluídas; a auditoria registrou a exclusão.
- Nenhum registro de demonstração/semeado foi intencionalmente alterado e nenhum código foi editado.

## Fontes consultadas

- Requisitos: `docs/product/05-requisitos-funcionais-pessoas-ministerios-frequencia.md`, `docs/product/06-requisitos-funcionais-acessos-permissoes.md`, `docs/product/07-requisitos-funcionais-timeline-notas.md`, `docs/product/08-requisitos-nao-funcionais.md`.
- Especificações e decisões: `.specs/features/emaus-mvp/spec.md`, `.specs/features/emaus-activities/spec.md`, `.specs/STATE.md`.
- Código de interface/serviços indicado por achado: caminhos citados nas respectivas seções.
- Fixture local: `README.md:35-39`, `prisma/seed.ts:9`, `e2e/demo-fixtures.ts:1`.
- Segurança dos dados de teste: `e2e/global-setup.ts:4-8`.

## Próximas ações recomendadas

1. Corrigir e repetir o salvamento de frequência com Administrador; depois repetir o fluxo de qualquer encontro como Secretaria.
2. Diagnosticar a exceção da Secretaria e reproduzir em sessão isolada até encontrar erro de cliente identificável.
3. Corrigir a carga do escopo ministerial na página `/ministerios` do Líder e definir a regra de cadastro rápido de visitante para Líder.
4. Corrigir os destinos de navegação e o valor inicial da data de promoção.
5. Priorizar as telas faltantes para recuperação de senha, escopo ministerial, vínculos/cargos, categorias/séries e resumo de frequência por ministério.
6. Alinhar os requisitos de foto com a decisão de escopo e sincronizar a credencial documentada/seed com a configuração usada no ambiente de QA.
