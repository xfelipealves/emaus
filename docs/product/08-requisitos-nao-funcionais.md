# Requisitos Não Funcionais — MVP

**Status:** primeira rodada de especificação aprovada na descoberta

## RNF-001 — Capacidade inicial

O MVP deve suportar, no mínimo:

- até 500 pessoas cadastradas;
- até 20 usuários simultâneos.

Esse limite orienta a arquitetura inicial sem projetar o produto prematuramente para redes de igrejas ou grande escala.

## RNF-002 — Responsividade e conexão

O sistema será uma aplicação web responsiva.

**Requisitos:**

- deve funcionar em computador e celular;
- exige conexão com a internet para operação;
- não haverá PWA instalável, funcionamento offline, sincronização posterior ou aplicativo nativo no MVP;
- fluxos de cadastro e presença devem ser utilizáveis em tela de celular durante encontros.

## RNF-003 — Fuso horário

Encontros, presenças, notas, timeline e registros de auditoria devem usar o fuso horário fixo `America/Sao_Paulo` no MVP.

## RNF-004 — Backup

Os dados do sistema devem possuir backup automático semanal com retenção mínima de 90 dias.

A definição de provedor, armazenamento, criptografia e procedimento de restauração pertence à fase de arquitetura e infraestrutura.

## RNF-005 — Auditoria

O sistema deve manter um log interno de auditoria para ações sensíveis.

No mínimo, deve registrar autor, data/hora, entidade afetada, ação executada e valores relevantes antes/depois quando aplicável.

**Ações cobertas:**

- criação, edição, inativação e mudança de status de pessoas;
- criação, edição e arquivamento de ministérios;
- criação e encerramento de vínculos ministeriais;
- lançamentos e correções de frequência;
- criação, edição e arquivamento de notas;
- criação, alteração e desativação de contas;
- mudanças de papel e de acesso a ministérios.

## RNF-006 — Dados pessoais

O MVP tratará dados pessoais como nome, telefone, data de nascimento e foto.

Não haverá, no MVP, campo específico para registrar consentimento ou ciência de tratamento de dados. Essa decisão não substitui revisão jurídica e adequação futura à LGPD.

## Decisões ainda abertas

- política de criptografia de dados em repouso e em trânsito;
- procedimento e periodicidade de teste de restauração de backup;
- políticas de senha, expiração e bloqueio por tentativas inválidas;
- hospedagem, monitoramento, disponibilidade e resposta a incidentes;
- requisitos de acessibilidade;
- política de retenção de logs de auditoria.
