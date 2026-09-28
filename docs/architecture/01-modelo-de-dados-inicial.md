# Modelo de Dados Inicial — Emaús

**Status:** primeira rodada de modelagem aprovada

Este documento traduz os requisitos e as decisões de interface em entidades persistentes. Nomes técnicos são conceituais; a escolha de ORM, banco e tipos concretos pertence à arquitetura técnica.

## 1. Entidades principais

### Pessoa

Representa qualquer pessoa acompanhada pela igreja, independentemente de ser visitante, membro ou inativa.

**Atributos principais:**

- identificador;
- nome completo;
- status: `visitante`, `membro` ou `inativo`;
- telefone conforme as regras de cadastro;
- data de nascimento opcional para visitante e obrigatória ao promover a membro;
- foto de perfil opcional e única;
- data da mudança de status;
- criação e atualização.

**Regras:**

- a idade não é armazenada; é calculada da data de nascimento no momento de consulta;
- pessoa comum não precisa de e-mail;
- não há exclusão física no MVP.

### Conta de acesso

Representa uma credencial para operar o sistema internamente.

**Atributos principais:**

- identificador;
- pessoa vinculada;
- nome de usuário único;
- e-mail obrigatório e único;
- segredo/senha protegida;
- papel: administrador, secretaria/recepção ou líder;
- estado: ativa ou desativada;
- criação, atualização e último acesso.

**Regras:**

- toda conta deve estar vinculada a uma Pessoa;
- cada Pessoa pode ter no máximo uma Conta;
- e-mail é requisito de Conta, não de Pessoa;
- conta desativada preserva autoria histórica e não pode iniciar sessão.

### Ministério

Unidade organizacional como Jovens, Louvor ou Adolescentes.

**Atributos principais:**

- identificador;
- nome;
- estado: ativo ou arquivado;
- criação e atualização.

### Vínculo ministerial

Relaciona Pessoa e Ministério, preservando participação histórica.

**Atributos principais:**

- pessoa;
- ministério;
- cargo fixo: líder ou membro;
- data de entrada;
- data de saída opcional;
- criação e atualização.

### Acesso ministerial

Define os ministérios que uma Conta com papel de líder pode operar.

**Atributos principais:**

- conta;
- ministério;
- concessão, remoção opcional e autor da concessão.

Cargo de líder no vínculo ministerial e permissão de acesso são relações independentes.

### Categoria de encontro

Categoria configurável por administrador, como Culto, Reunião ou Evento.

### Encontro

Representa uma ocorrência concreta de culto, reunião ou evento.

**Atributos principais:**

- identificador;
- título;
- categoria;
- data e hora no fuso `America/Sao_Paulo`;
- público-alvo: toda a igreja ou ministérios selecionados;
- estado administrativo: `rascunho`, `agendado` ou `cancelado`;
- série recorrente de origem opcional;
- criador e timestamps.

Encontros passados continuam consultáveis sem um estado obrigatório de encerramento.

### Série recorrente de encontros

Define uma repetição planejada, como culto semanal ou encontro mensal de um ministério.

**Atributos principais:**

- título e categoria padrão;
- regra de recorrência;
- público-alvo padrão;
- data de início e término opcional;
- estado: ativa ou encerrada.

Uma Série gera ocorrências de Encontro independentes. Cada ocorrência pode ser editada ou cancelada sem alterar as demais ocorrências ou a regra original.

### Presença

Relaciona uma Pessoa e um Encontro.

**Atributos principais:**

- encontro;
- pessoa;
- estado: `nao_confirmado`, `presente` ou `ausente`;
- criação, atualização e autor da última alteração.

**Regras atuais:**

- ao abrir a frequência, o público elegível é calculado pelos vínculos ministeriais atuais;
- para cada pessoa exibida, deve existir um registro inicial como `nao_confirmado`;
- mudanças no estado são persistidas imediatamente;
- mudanças posteriores de vínculos podem impactar a lista de elegíveis de encontros ainda consultados, conforme decisão de produto atual.

### Nota de acompanhamento

Registra contexto livre no perfil da Pessoa.

**Atributos principais:**

- pessoa;
- texto simples;
- autor;
- data de criação;
- data de última alteração;
- estado de arquivamento.

Notas não possuem título, anexos, comentários ou tipos estruturados no MVP.

### Versão de nota

Preserva o conteúdo de cada alteração feita em uma Nota.

**Atributos principais:**

- nota;
- conteúdo da versão;
- autor da alteração;
- data/hora;
- número sequencial da versão.

Notas continuam editáveis, mas cada edição cria uma Versão de nota. A Nota mantém o texto mais recente para leitura rápida na timeline.

### Auditoria

Registra ações sensíveis para rastreabilidade.

**Atributos principais:**

- autor (Conta, quando aplicável);
- entidade e identificador afetados;
- ação;
- dados relevantes antes/depois quando aplicável;
- data e hora no fuso da aplicação.

## 2. Relações principais

```text
Pessoa 1 ── 0..1 Conta de acesso
Pessoa 1 ── N Vínculo ministerial N ── 1 Ministério
Conta  1 ── N Acesso ministerial N ── 1 Ministério
Encontro 1 ── N Presença N ── 1 Pessoa
Série recorrente 1 ── N Encontro
Pessoa 1 ── N Nota de acompanhamento
Nota 1 ── N Versão de nota
Conta  1 ── N Auditoria
```

## 3. Decisões pendentes antes do esquema técnico

- ciclo de vida detalhado da presença após o encontro;
- retenção técnica de fotos, auditorias e backups;
- índices e estratégias de busca;
- provedor de PostgreSQL, hospedagem, e-mail de recuperação, monitoramento e ambientes;
- estratégia de testes após as primeiras telas funcionais.

**Decisões já fechadas:** PostgreSQL, Prisma ORM e autenticação própria por credenciais com Argon2 e sessão em cookie seguro. A decisão original de postergar upload de foto foi supersedida por AD-011 (27/09/2026): foto opcional e substituível com upload fazem parte da frente `emaus-profile-photo-upload`; os detalhes de armazenamento e retenção dependem do design dessa frente.
