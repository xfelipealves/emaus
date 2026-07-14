# Requisitos Funcionais — Acessos e Permissões

**Status:** primeira rodada de especificação aprovada na descoberta

Este documento especifica autenticação, contas internas, papéis e limites de visibilidade do MVP. Ele complementa os requisitos de Pessoas, Ministérios e Frequência.

## 1. Contas internas

### RF-ACS-001 — Autenticação

O Emaús deve permitir acesso de usuários internos por nome de usuário e senha.

**Regras e critérios de aceite:**

- cada conta possui nome de usuário único;
- cada conta possui senha;
- e-mail é obrigatório para toda conta interna, mesmo não sendo o identificador principal de login;
- conta deve estar ativa para iniciar sessão.

### RF-ACS-002 — Vínculo obrigatório entre conta e pessoa

Toda conta interna deve ser vinculada a uma pessoa já cadastrada no Emaús.

**Regras e critérios de aceite:**

- não é possível criar conta sem selecionar uma pessoa existente;
- o vínculo permite identificar corretamente o autor de notas, mudanças e correções de presença;
- status de membro, visitante ou inativo da pessoa não desativa automaticamente a conta de acesso.

### RF-ACS-003 — Criação de conta

Somente administradores podem criar novas contas internas.

**Regras e critérios de aceite:**

- não haverá auto cadastro público;
- não haverá código de convite no MVP;
- o administrador escolhe pessoa vinculada, nome de usuário, e-mail e papel da conta.

### RF-ACS-004 — Recuperação e redefinição de senha

O sistema deve suportar recuperação de senha por e-mail e redefinição manual por administrador.

**Regras e critérios de aceite:**

- usuário pode iniciar recuperação pelo e-mail da conta;
- administrador pode redefinir a senha de uma conta;
- a recuperação não pode revelar se um e-mail inexistente possui conta no sistema;
- detalhes técnicos de expiração e token serão definidos na fase de segurança/arquitetura.

### RF-ACS-005 — Desativação de conta

Administrador deve poder desativar uma conta independentemente do status da pessoa vinculada.

**Regras e critérios de aceite:**

- conta desativada não pode iniciar sessão;
- desativação não exclui a pessoa nem os registros históricos assinados pela conta;
- o sistema preserva autoria anterior em notas e auditorias;
- não haverá exclusão física de conta no MVP.

## 2. Papéis fixos

O MVP possui três papéis fixos: administrador, secretaria/recepção e líder.

Cargos ministeriais de líder ou membro não definem automaticamente permissão de sistema. Papéis de acesso e cargos ministeriais são independentes.

### RF-ACS-006 — Administrador

Administrador possui acesso completo à operação do MVP.

Pode:

- criar, editar, inativar e consultar pessoas;
- criar, editar e arquivar ministérios;
- vincular pessoas e definir cargos fixos nos ministérios;
- criar e administrar encontros e séries recorrentes;
- lançar e corrigir frequência;
- criar, editar e arquivar notas;
- criar, editar e desativar contas;
- definir papel de acesso e conceder acesso adicional a ministérios.

Na implantação inicial, a igreja pode configurar todos os usuários como administradores.

### RF-ACS-007 — Secretaria/recepção

Secretaria/recepção pode operar cadastro e frequência para qualquer encontro, sem administrar estrutura organizacional ou acessos.

Pode:

- cadastrar e editar pessoas;
- promover visitante a membro e inativar pessoa;
- consultar perfis e timeline;
- criar e editar notas de acompanhamento permitidas;
- lançar e corrigir frequência em qualquer encontro;
- cadastrar visitante rápido pela lista de frequência.

Não pode:

- criar, editar ou arquivar ministérios;
- gerenciar vínculos ministeriais;
- criar, editar ou desativar contas;
- alterar papéis ou permissões;
- conceder acesso a ministérios.

### RF-ACS-008 — Líder

Líder opera apenas nos ministérios explicitamente concedidos por administrador.

Pode, nos ministérios concedidos:

- consultar participantes atuais e antigos;
- consultar perfis e timeline dessas pessoas;
- criar, editar e arquivar notas permitidas;
- criar encontros e lançar/corrigir frequência dos encontros sob sua atuação.

Não pode:

- criar, editar ou arquivar ministérios;
- conceder acesso a outro usuário;
- administrar contas ou papéis;
- acessar livremente pessoas sem vínculo histórico ou atual com seus ministérios concedidos.

## 3. Concessão de acesso ministerial

### RF-ACS-009 — Escopo por ministério

Administrador deve poder conceder a uma conta de líder acesso a um ou mais ministérios.

**Regras e critérios de aceite:**

- o acesso ministerial é configurado de forma explícita;
- uma conta pode possuir acesso a vários ministérios;
- uma pessoa pode receber acesso a um ministério mesmo que não tenha cargo de líder naquele ministério;
- remoção do acesso impede novas consultas e operações futuras no ministério, sem remover a autoria de registros já criados;
- líder pode consultar participantes atuais e antigos dos ministérios aos quais tem acesso.

## Decisões ainda abertas

- política de força, expiração e troca de senha;
- necessidade de autenticação em dois fatores em uma evolução futura;
- quais ações de secretaria exigem confirmação adicional;
- se líderes podem editar dados cadastrais básicos de pessoas dos ministérios permitidos;
- política de sessão, dispositivos conectados e encerramento de sessão.
