# Fluxos Essenciais do MVP — Emaús

**Status:** primeira rodada de design aprovada

Este documento descreve os caminhos operacionais prioritários antes da criação dos wireframes.

## 1. Cadastro de pessoa

### Entrada

O usuário acessa **Cadastrar pessoa** pela Home ou pela área Pessoas.

### Escolha inicial

O sistema apresenta duas opções:

- **Visitante**;
- **Membro**.

Cada opção abre um formulário adequado ao status escolhido.

### Conclusão

Após salvar, o sistema deve:

1. confirmar o sucesso de forma discreta;
2. abrir o perfil da pessoa recém-criada;
3. permitir complementar dados, foto, nota ou vínculo ministerial sem pesquisar novamente.

## 2. Lançamento de frequência

### Entrada pela Home

O atalho **Lançar frequência** abre um seletor com:

- encontros de hoje;
- próximos encontros;
- ação **Criar encontro**.

### Lista de presença

Ao selecionar ou criar um encontro, o usuário abre uma lista pesquisável de pessoas elegíveis.

Para cada pessoa, pode definir rapidamente:

- Presente;
- Ausente;
- Não confirmado.

A tela também permite:

- buscar pessoa já cadastrada;
- cadastrar visitante rápido por nome, sem sair do lançamento;
- acompanhar resumo dos estados registrados.

### Persistência

Cada alteração de presença é salva imediatamente.

A interface deve informar sucesso ou falha de forma discreta, sem exigir um botão final de salvar. Isso permite interromper e retomar o lançamento sem perder dados.

## 3. Navegação em celular

No celular, a navegação operacional usa barra inferior com:

1. Início;
2. Pessoas;
3. Ministérios;
4. Encontros.

**Configurações** deve ficar dentro da opção **Mais**, evitando excesso de itens na barra inferior.

No desktop, as mesmas áreas podem ficar em uma navegação lateral persistente.

## 4. Princípios de interação

- ações recorrentes precisam de poucos toques;
- toda persistência automática deve ter retorno visual claro;
- busca deve estar disponível antes de filtros avançados;
- usuário não deve perder contexto após cadastrar pessoa ou alterar presença;
- operações restritas devem respeitar permissões, mas a interface não deve exibir opções indisponíveis como se fossem acessíveis.

## Próximos itens de design

1. wireframes de baixa fidelidade para Home, Pessoas, Perfil, Ministério, Encontros e Presença;
2. estados de interface: vazio, carregamento, erro, sucesso e confirmação;
3. direção visual: tom, referências, cores e componentes;
4. modelo de dados e arquitetura técnica.
