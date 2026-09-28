# Contexto — frentes de melhoria E2E

**Reunião/decisões:** respostas explícitas do usuário em 27/09/2026.
**Pacote:** `.specs/e2e-remediation/README.md`
**Estado:** decisões de produto capturadas; demais ambiguidades continuam nos respectivos `spec.md`.

## Limite

Transformar o levantamento E2E de três perfis em especificações separadas, rastreáveis aos requisitos de produto e com critérios testáveis. Não implementar código nesta etapa.

## Decisões confirmadas

### Visitante rápido pelo Líder

- O Líder pode cadastrar visitante somente de forma contextual no quadro de frequência de um encontro que esteja dentro do escopo concedido.
- Essa permissão não concede edição geral de Pessoas.
- As regras constam em `emaus-leader-access-scopes/spec.md` e mantêm autorização server-side e integridade de criação/presença como requisitos de design.

### Foto de perfil

- Upload de foto opcional e substituível será implementado nesta frente para cumprir RF-PES-004.
- AD-005, que adiava upload, foi supersedida por AD-011 em `.specs/STATE.md`.
- Formatos, tamanho, dimensões e armazenamento ficam para Design, antes de tarefas de implementação.

### Resumo de frequência por Ministério

- Terá período selecionável.
- Exibirá contagem de `presente`, `ausente` e `não confirmado`.
- Encontros de toda a igreja entram no resumo de cada Ministério, contando a frequência de seus integrantes.
- O critério temporal para considerar uma Pessoa integrante na agregação continua para o design, alinhado à regra de vigência histórica dos vínculos. Também continua para o design a inclusão de frequência de encontros cancelados.

## Limites desta fase

- As especificações permanecem em `Draft` até aprovação explícita dos documentos.
- Nenhuma especificação presume provedor de e-mail, storage, formato de imagem, ou SLA.
- A atribuição de encontro global a Ministério foi confirmada; a vigência do vínculo que define integrantes e o tratamento de encontros cancelados permanecem para design.
- Nenhuma suíte de teste destrutiva foi executada para redigir os documentos.

## Referências

- Levantamento manual: `docs/2026-09-25-levantamento-e2e-perfis.md`.
- Requisitos principais: `docs/product/05-requisitos-funcionais-pessoas-ministerios-frequencia.md`, `docs/product/06-requisitos-funcionais-acessos-permissoes.md`, `docs/product/07-requisitos-funcionais-timeline-notas.md`, `docs/product/08-requisitos-nao-funcionais.md`.
