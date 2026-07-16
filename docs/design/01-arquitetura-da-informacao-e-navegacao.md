# Arquitetura da Informação e Navegação — Emaús

**Status:** primeira rodada de design aprovada

Este documento define a organização funcional das telas e os fluxos de navegação do MVP. Não define cores, tipografia, componentes visuais ou tecnologia.

## 1. Navegação principal

A aplicação terá cinco áreas principais:

1. **Início**
2. **Pessoas**
3. **Ministérios**
4. **Encontros e Frequência**
5. **Configurações**

A navegação deve ser acessível em computador e celular. No celular, os fluxos críticos devem continuar rápidos, principalmente cadastro e frequência.

## 2. Início

A tela inicial não será um dashboard analítico completo. Ela terá função operacional.

### Conteúdo

- atalhos rápidos para cadastrar pessoa, criar encontro e lançar frequência;
- próximos encontros;
- contagens simples relevantes à operação.

Gráficos, alertas automáticos de baixa frequência e análises aprofundadas permanecem fora do MVP.

## 3. Pessoas

### Tela principal

A área de Pessoas será uma lista pesquisável com abas:

- Todos;
- Visitantes;
- Membros;
- Inativos.

A lista deve funcionar em desktop e celular, permitindo localizar rapidamente uma pessoa por nome.

### Perfil individual

O perfil terá cabeçalho com dados essenciais da pessoa e abas:

1. **Visão geral** — dados cadastrais e ações de status;
2. **Timeline** — histórico cronológico com filtros;
3. **Ministérios** — vínculos atuais e históricos;
4. **Frequência** — histórico individual de encontros.

## 4. Ministérios

### Tela principal

A área de Ministérios será uma lista pesquisável de ministérios ativos e arquivados, conforme a permissão do usuário.

### Perfil de ministério

Ao abrir um ministério, o usuário verá pelo menos:

- participantes;
- líderes;
- histórico de vínculos;
- acesso aos encontros relacionados, quando aplicável.

## 5. Encontros e Frequência

### Visão inicial

A área abre em uma lista cronológica de próximos encontros, com alternância para visualização em calendário.

### Lançamento de presença

Ao abrir um encontro, a tela de presença deve ter:

- lista pesquisável de pessoas elegíveis;
- indicador do estado atual de cada presença;
- ação rápida para definir `Presente`, `Ausente` ou `Não confirmado`;
- opção de localizar pessoa existente;
- opção de cadastrar visitante rápido com apenas nome, sem sair da lista;
- resumo dos estados lançados no encontro.

O desenho deve priorizar interação de toque no celular, sem sacrificar consulta em desktop.

## 6. Configurações

Configurações terá páginas internas separadas:

1. **Usuários e Acessos** — contas, papéis e permissões por ministério;
2. **Categorias de Encontro** — categorias customizáveis;
3. **Configurações da Igreja** — opções institucionais do MVP, incluindo o fuso configurado para operação.

Somente administradores podem acessar as configurações estruturais.

## 7. Princípios de navegação

- a pessoa é o centro da aplicação; qualquer fluxo importante deve permitir chegar ao perfil individual;
- frequência sempre acontece no contexto de um encontro;
- atividades administrativas não devem poluir a operação diária de cadastro e presença;
- ações destrutivas devem ser substituídas por arquivamento/inativação e confirmação;
- páginas de lista devem priorizar busca e filtros simples antes de filtros avançados;
- atalhos da Home devem diminuir a quantidade de cliques para as operações mais comuns.

## Próximos itens de design

1. detalhar fluxos de navegação por tarefa;
2. criar wireframes de baixa fidelidade;
3. definir estados vazios, carregamento, erro e confirmação;
4. definir identidade visual e design system;
5. somente depois, iniciar arquitetura técnica e escolha de stack.
