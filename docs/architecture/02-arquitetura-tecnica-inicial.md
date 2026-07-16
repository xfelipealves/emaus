# Arquitetura Técnica Inicial — Emaús

**Status:** decisões iniciais aprovadas

## 1. Visão geral

O MVP será uma aplicação web responsiva construída em uma única base TypeScript. O Next.js atenderá interface e rotas do servidor; PostgreSQL guardará os dados relacionais; Prisma será a camada de esquema, migrations e consultas.

```text
Navegador
  │
  ▼
Next.js (interface + rotas de servidor)
  │
  ├── Autenticação por sessão segura
  ├── Regras de acesso e auditoria
  └── Prisma ORM
          │
          ▼
      PostgreSQL
```

## 2. Stack aprovada

| Camada | Decisão |
| --- | --- |
| Linguagem | TypeScript |
| Aplicação web | Next.js |
| Banco de dados | PostgreSQL |
| ORM e migrations | Prisma ORM |
| Autenticação | credenciais próprias: usuário/senha, Argon2 e sessão em cookie seguro |
| Interface | Tailwind CSS e componentes próprios reutilizáveis |
| Fotos | campo previsto no modelo, mas sem upload na primeira versão técnica |

Versões exatas de dependências serão fixadas no início da implementação, usando versões estáveis compatíveis entre si.

## 3. Autenticação e acesso

- Conta interna é vinculada a uma Pessoa.
- Login usa nome de usuário e senha.
- Senhas serão protegidas com Argon2; nunca armazenadas em texto puro.
- Sessões serão mantidas em cookie seguro, com validação no servidor.
- E-mail de Conta é obrigatório para recuperação de senha; e-mail não é obrigatório no cadastro da Pessoa.
- Papéis e escopos ministeriais serão verificados no servidor, e não somente escondidos na interface.

## 4. Organização inicial da aplicação

Estrutura proposta:

```text
src/
  app/                 # páginas e rotas do Next.js
  components/          # componentes visuais reutilizáveis
  features/            # módulos de domínio: pessoas, ministérios, encontros...
  lib/                 # Prisma, autenticação, validações e utilitários
  server/              # serviços de domínio, autorização e auditoria
prisma/
  schema.prisma         # modelo relacional e migrations
```

Cada ação de escrita deve passar por um serviço de domínio que:

1. valida os dados;
2. verifica permissão;
3. atualiza o banco em transação quando necessário;
4. cria o registro de auditoria aplicável.

## 5. Fotos de perfil

O modelo de Pessoa preserva a possibilidade de foto de perfil, mas o primeiro corte técnico não implementará upload, processamento ou armazenamento de imagem. A interface usará iniciais enquanto isso.

## 6. Itens a decidir antes do plano de implementação

- hospedagem do Next.js;
- provedor de PostgreSQL;
- envio de e-mail para recuperação de senha;
- estratégia de backups semanais com retenção de 90 dias;
- monitoramento e logs;
- ambiente de homologação e produção;
- biblioteca de testes e estratégia de testes de interface/integração.
