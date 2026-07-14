# Escopo do MVP — Emaús

**Status:** rascunho refinado antes dos requisitos funcionais

## Objetivo do MVP

Entregar uma aplicação web responsiva para organizar pessoas, ministérios e frequência de uma igreja, preservando um histórico confiável de cada pessoa.

## Dentro do MVP

### 1. Pessoas

- cadastro de visitante, membro e pessoa inativa;
- atualização de dados cadastrais básicos;
- foto e data de nascimento;
- nome como único campo obrigatório para cadastro rápido de visitante;
- telefone e data de nascimento obrigatórios ao promover visitante para membro;
- perfil individual;
- busca de pessoas;
- mudança de status sem perda de histórico;
- inativação e arquivamento, sem exclusão física no MVP;
- timeline por pessoa;
- notas de acompanhamento datadas e identificadas pelo autor.

### 2. Ministérios

- cadastro de ministérios customizáveis;
- vínculo de uma pessoa a um ou mais ministérios;
- histórico de entrada e saída do vínculo ministerial;
- cargos fixos de líder e membro no vínculo ministerial;
- consulta de pessoas por ministério;
- base de permissão para limitar usuários a ministérios específicos;
- permissão adicional a ministérios definida por administrador.

### 3. Encontros e presença

- categorias de encontros customizáveis por administradores;
- criação de encontros e séries recorrentes, como cultos e programações;
- lançamento manual de presença para visitantes e membros, com estados presente, ausente e não confirmado;
- cadastro rápido de visitante pela lista de frequência;
- consulta do histórico de presença por pessoa;
- lista de presença por encontro e resumo de frequência por ministério;
- correção posterior de presença;
- trilha de auditoria da correção.

### 4. Acessos

- autenticação de usuários;
- perfil de administrador;
- perfil de líder com acesso limitado a ministérios concedidos;
- configuração inicial permitindo que todos os usuários operem como administradores.

### 5. Plataforma

- painel web;
- interface responsiva para uso em computador e celular;
- foco em uso rápido durante encontros.

## Fora do MVP

- jornada estruturada com etapas, regras de avanço e automações;
- WhatsApp integrado, chatbot, disparos ou automações de mensagem;
- financeiro, dízimos, doações e prestação de contas;
- aplicativo nativo para Android ou iOS;
- QR Code para presença;
- reconhecimento facial;
- dashboard analítico avançado;
- múltiplas igrejas, filiais ou congregações;
- cargos e funções ministeriais completamente customizáveis;
- integrações com calendários externos;
- comunicação pública, mural, transmissões ou conteúdo para membros.

## Evoluções já identificadas

As seguintes ideias não fazem parte do MVP, mas devem orientar decisões para não bloquear a evolução:

1. jornadas de acompanhamento individual;
2. cargos e funções customizáveis por ministério;
3. comunicação contextual e integração com WhatsApp;
4. relatórios de frequência e alertas de afastamento;
5. QR Code ou outros métodos de check-in;
6. aplicativo voltado ao membro.

## Critério de sucesso do MVP

O MVP será considerado bem-sucedido quando a igreja conseguir operar seus encontros sem planilhas paralelas para cadastro e frequência, localizar rapidamente o histórico de uma pessoa e identificar sua participação em ministérios.
