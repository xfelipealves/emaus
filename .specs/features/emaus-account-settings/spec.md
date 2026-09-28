# Contas, recuperação de senha e entrada em Configurações — especificação

**Status:** Draft para revisão; inclui os requisitos aprovados e a falha inconclusiva do envio de criação de conta.

## Problema

O link global “Configurações” leva a `/configuracoes`, que retorna 404. Não há recuperação por e-mail nem redefinição administrativa de senha, exigidas por RF-ACS-004. O fluxo de criação de conta QA desviou para `/ministerios`, sem POST nem conta criada; isso requer reteste, não é ainda uma quebra confirmada da criação.

## Objetivos

- [ ] Entregar recuperação de senha por e-mail que não revele se a conta existe.
- [ ] Permitir redefinição manual de senha por Administrador.
- [ ] Tornar a navegação de Configurações válida e adequada ao papel.
- [ ] Fazer criação/desativação de conta oferecer resultado previsível, autorizado e auditado.

## Fora de escopo

| Item | Motivo |
|---|---|
| MFA ou login federado | RF-ACS-004 e decisões atuais deixam MFA como evolução futura. |
| Troca periódica de senha, bloqueio por tentativas e política de força | Decisões de segurança continuam abertas e exigem escopo próprio. |
| Exibir credenciais em auditoria ou mensagens | Senha é dado de autenticação e não deve ser registrada em claro. |

## Premissas e decisões pendentes

| Tema | Padrão | Racional | Confirmado? |
|---|---|---|---|
| Recuperação | Resposta externa indistinguível para e-mail cadastrado/inexistente | RF-ACS-004 impede enumeração. | Sim. |
| Redefinição manual | Administrador inicia redefinição para conta existente | RF-ACS-004. Método concreto fica para design. | Sim quanto à capacidade; método aberto. |
| Landing de Configurações | `/configuracoes` é entrada válida, exibindo somente destinos disponíveis ao papel; para papel sem função permitida, menu não oferece link quebrado | Corrige o 404 sem ampliar acesso. | Hipótese não confirmada. |
| Fluxo de criação QA | Repetir em ambiente isolado, confirmar sucesso/erro, sem retentativa cega após navegação inesperada | E2E não gerou POST. | Procedimento de teste. |
| Credenciais demo | Sincronizar documentação e fixtures com a configuração oficial do ambiente sem gravar senha sensível nos documentos | E2E mostrou divergência. | Pendente de definir fonte autoritativa da configuração. |

**Questões em aberto:** escolher mecanismo seguro para redefinição manual, parâmetros de token/expiração para recuperação e configuração de e-mail. A exigência de não enumerar e-mails é fixa mesmo antes dessas decisões.

## Histórias e critérios de aceite

### P1 — Recuperar senha por e-mail

Como usuário que esqueceu a senha, quero iniciar recuperação pelo e-mail da conta sem revelar se ela existe.

1. **WHEN** pessoa envia e-mail para iniciar recuperação **THEN** o sistema **SHALL** apresentar resposta indistinguível para endereço cadastrado e não cadastrado.
2. **WHEN** e-mail pertence a uma conta recuperável **THEN** o sistema **SHALL** disponibilizar fluxo de redefinição ao titular por mecanismo seguro definido no design.
3. **WHEN** token/ação de recuperação é inválido ou expirado segundo política aprovada **THEN** o sistema **SHALL** rejeitar a mudança sem alterar a senha.
4. **WHEN** nova senha é aceita **THEN** o sistema **SHALL** armazenar somente hash apropriado e permitir autenticação com a nova credencial.
5. **WHEN** qualquer resposta de recuperação ocorre **THEN** o sistema **SHALL NOT** expor em tela, log ou diferença de resposta se aquele e-mail existe.

### P1 — Redefinir senha como Administrador

1. **WHEN** Administrador inicia redefinição para conta existente **THEN** o sistema **SHALL** concluir o procedimento aprovado e manter trilha de auditoria sem guardar senha em claro.
2. **WHEN** usuário que não é Administrador tenta redefinir senha de outra conta **THEN** o sistema **SHALL** negar no servidor.
3. **WHEN** a redefinição termina **THEN** as credenciais resultantes **SHALL** autenticar e a senha anterior **SHALL** deixar de autenticar, conforme política definida no design.

### P1 — Criar e desativar conta

1. **WHEN** Administrador cria conta com Pessoa existente, nome de usuário/e-mail únicos, senha e papel **THEN** o sistema **SHALL** criar conta vinculada e exibir confirmação na tela de usuários.
2. **WHEN** formulário inválido, duplicado ou servidor indisponível **THEN** o sistema **SHALL** manter o usuário na rota apropriada, mostrar erro contextual e não navegar para rota alheia.
3. **WHEN** usuário não Administrador tenta criar/desativar conta **THEN** o sistema **SHALL** negar a operação.
4. **WHEN** Administrador desativa conta **THEN** o sistema **SHALL** preservar autoria e dados anteriores e negar novos logins dessa conta.
5. **WHEN** ação sensível de conta é concluída **THEN** o sistema **SHALL** registrar autor, data/hora, conta e tipo de ação sem registrar senha.

### P1 — Navegar em Configurações

1. **WHEN** usuário seleciona “Configurações” **THEN** o sistema **SHALL** navegar a uma página existente apropriada ao seu papel, nunca `/configuracoes` 404.
2. **WHEN** Administrador abre Configurações **THEN** o sistema **SHALL** oferecer links para funções autorizadas de contas/auditoria.
3. **WHEN** Secretaria ou Líder acessa rota administrativa direta **THEN** o sistema **SHALL** negar acesso sem renderizar dados administrativos.

**Teste independente:** criar e desativar conta QA em ambiente isolado; iniciar recuperação para e-mail existente e inexistente comparando respostas; validar novo login e destinos de navegação por papel.

## Casos de borda

- Conta inexistente, desativada ou e-mail malformado sem enumeração.
- Reenvio de solicitação de recuperação não cria múltiplas mudanças concorrentes de credencial.
- Conta vinculada a uma Pessoa continua respeitando uma conta por Pessoa.
- Usuário/conta desativada preserva referência histórica.
- Erro no envio de formulário não navega para módulo diferente e não cria parcialmente.
- Credenciais e tokens não aparecem no log/auditoria.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| ACC-01 | RF-ACS-004 | Recuperação 1–5 | Draft |
| ACC-02 | RF-ACS-004/006, RNF-005 | Redefinição 1–3 | Draft |
| ACC-03 | RF-ACS-001/002/003/005/006, RNF-005 | Conta 1–5 | Draft |
| ACC-04 | RF-ACS-006/007/008 | Navegação 1–3 | Draft |

**Cobertura:** 4 requisitos mapeados; mecanismo de recuperação/configuração de e-mail e landing por papel aguardam design.

## Sucesso

- [ ] Recuperação por e-mail não permite enumerar contas.
- [ ] Administrador consegue redefinir senha e operar ciclo de conta com auditoria.
- [ ] Nenhum perfil recebe destino de Configurações que resulte em 404.
- [ ] A tentativa de criação de conta tem resultado claro, sem desvio de rota.
