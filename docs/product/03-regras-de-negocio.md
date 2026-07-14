# Regras de Negócio Iniciais — Emaús

**Status:** decisões confirmadas nesta etapa de descoberta

## Pessoas e histórico

- **RN-001 — Preservação do cadastro:** uma pessoa inativada continua cadastrada e mantém todos os seus registros históricos.
- **RN-002 — Mudança de status:** uma pessoa pode mudar entre visitante, membro e inativo sem que os fatos já registrados sejam apagados.
- **RN-003 — Visitantes com frequência:** visitantes podem ter presença registrada em encontros.
- **RN-004 — Perfil histórico:** cada pessoa possui uma timeline que reúne eventos relevantes do seu relacionamento com a igreja.
- **RN-005 — Notas:** anotações de acompanhamento são permitidas no perfil e precisam informar data/hora e autor.

## Ministérios

- **RN-006 — Participação múltipla:** uma pessoa pode estar vinculada a mais de um ministério.
- **RN-007 — Cargos por contexto:** cargos e funções pertencem ao vínculo da pessoa com um ministério, não à pessoa de forma global.
- **RN-008 — Evolução de cargos:** ministérios e cargos devem poder evoluir para configuração customizável; a entrega completa dessa configuração não é obrigatória no MVP.

## Encontros e frequência

- **RN-009 — Presença por encontro:** a frequência é registrada em relação a um encontro específico.
- **RN-010 — Correção permitida:** registros de presença podem ser corrigidos depois do lançamento inicial.
- **RN-011 — Auditoria da correção:** toda correção de presença preserva o estado anterior, o estado posterior, o usuário responsável e a data/hora da alteração.
- **RN-012 — Histórico de frequência:** o histórico de presença de visitantes e membros deve permanecer consultável mesmo após mudanças de status.

## Acessos e visibilidade

- **RN-013 — Administração inicial:** a primeira implantação pode operar com todos os usuários como administradores.
- **RN-014 — Limite por ministério:** o sistema deve suportar, no MVP, a restrição de líderes a ministérios específicos.
- **RN-015 — Concessão adicional:** um administrador poderá conceder a uma pessoa acesso a ministérios adicionais, inclusive quando ela não for líder daquele ministério.
- **RN-016 — Visibilidade de notas:** no MVP, notas não terão categoria confidencial separada; sua visualização seguirá a permissão de acesso ao perfil.

## Decisões em aberto

- Quais campos de cadastro são obrigatórios para visitante e para membro.
- Se haverá exclusão física de pessoas ou somente inativação/arquivamento.
- Se a correção de presença exigirá motivo textual obrigatório.
- Quais encontros recorrentes precisam existir no MVP e como serão criados.
- Quais dados devem aparecer primeiro na timeline e nos relatórios iniciais.
