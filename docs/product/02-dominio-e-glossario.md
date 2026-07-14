# Domínio e Glossário — Emaús

**Status:** rascunho para validação antes dos requisitos funcionais

Este documento padroniza os termos do negócio. Os termos aqui definidos serão usados nas futuras especificações, banco de dados, telas e critérios de aceite.

## Pessoa

Registro central de um indivíduo acompanhado pela igreja. Uma pessoa possui dados cadastrais e uma linha do tempo própria.

Dados iniciais esperados: nome, telefone, data de nascimento, foto e status. Campos adicionais serão definidos durante os requisitos funcionais.

## Status da pessoa

- **Visitante:** pessoa que visitou ou iniciou contato com a igreja, mas não foi integrada como membro.
- **Membro:** pessoa integrada à membresia da igreja.
- **Inativo:** pessoa que deixa de estar ativa na comunidade, sem exclusão do seu cadastro ou histórico.

O status representa a situação atual; ele não substitui nem elimina o histórico anterior.

## Ministério

Unidade organizacional customizável da igreja que reúne pessoas por área, público ou serviço. Exemplos possíveis: Jovens, Adolescentes, Louvor, Mídia, Diaconia e Crianças.

No contexto inicial do Emaús, o termo **ministério** substitui o termo genérico “grupo”. O sistema deve permitir que uma pessoa participe de mais de um ministério.

## Vínculo ministerial

Relação entre uma pessoa e um ministério. Uma mesma pessoa pode ter vínculos em vários ministérios.

No futuro, esse vínculo poderá conter cargos e funções customizáveis, como líder, vice-líder, coordenador, voluntário ou membro. A modelagem do MVP deve evitar impedir essa evolução, mas não precisa entregar toda a gestão customizável de cargos no primeiro ciclo.

## Cargo ou função ministerial

Responsabilidade de uma pessoa dentro de um ministério. Não é uma característica global da pessoa: alguém pode liderar um ministério e ser membro em outro.

A definição detalhada de cargos customizáveis fica como evolução posterior, salvo se o levantamento funcional demonstrar que ela é indispensável já no MVP.

## Encontro

Ocorrência datada para a qual a igreja pode registrar participação. Exemplos: culto, reunião de ministério, célula, EBD, conferência ou programação especial.

O termo é propositalmente genérico para que frequência não fique limitada a cultos.

## Presença

Registro de participação de uma pessoa em um encontro. Visitantes e membros podem ter presença registrada.

## Correção de presença

Alteração posterior em um registro de presença. A presença corrigida deve manter trilha de auditoria: valor anterior, valor posterior, autor da alteração e data/hora da alteração. A necessidade de exigir motivo textual será decidida nos requisitos funcionais.

## Timeline (linha do tempo)

Histórico cronológico de fatos relacionados a uma pessoa. Exemplos: cadastro, mudança de status, vínculo em ministério, presença em encontro, nota adicionada e correção de presença.

## Nota de acompanhamento

Registro textual datado associado a uma pessoa, usado para contextualizar acontecimentos ou acompanhamento. No MVP, não haverá classificação especial de confidencialidade pastoral: usuários que tenham acesso ao perfil poderão visualizar as notas permitidas pelo seu nível de acesso.

## Jornada

Possível estrutura futura para acompanhar etapas de desenvolvimento de uma pessoa, como visitante, integração, batismo, serviço ou liderança.

A jornada é uma ideia relevante para o produto, inspirada em plataformas analisadas, mas seus passos e regras ainda não estão definidos. Portanto, ela não compõe o escopo inicial do MVP.
