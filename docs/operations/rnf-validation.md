# Validação operacional dos requisitos não funcionais

Este documento registra o que pode ser reproduzido no repositório e o que ainda
depende de infraestrutura externa. Os testes usam dados sintéticos e o runner
E2E cria um PostgreSQL exclusivo, publicado somente em loopback, com volume em
memória e remoção automática ao final.

## RNF-001 — 500 Pessoas e 20 sessões simultâneas

`npm run test:capacity` prepara exatamente 500 Pessoas sintéticas e 20 contas
sintéticas no banco descartável, autentica as 20 contas em contextos separados e
abre a lista de Pessoas ao mesmo tempo nesses 20 contextos. O runner compila e
serve a aplicação em modo de produção local. O teste registra p50, p95 e máximo
da abertura simultânea de `/pessoas?status=all`; cada sessão precisa renderizar
o título da página dentro do timeout de 30 segundos usado pela asserção
Playwright.

O requisito não define meta de latência ou taxa de erro. Por isso, a execução
registra as medições sem transformar um valor escolhido pela equipe de QA em
SLA de produto. O resultado local é evidência de repetibilidade com dados
sintéticos, não uma medição de produção nem uma garantia para hardware ainda não
especificado.

## RNF-002 — uso em celular

`npm run test:e2e -- --project=mobile-chromium` executa o projeto Playwright
Pixel 7. O cenário verifica ausência de rolagem horizontal no login, cadastro e
frequência; cadastra uma Pessoa pelo formulário e marca presença com toque em
um encontro sintético. A chamada passa pelo runner e usa o mesmo banco
descartável isolado descrito abaixo.

## RNF-004 — backup semanal, retenção de 90 dias e restauração

**Situação: não verificado; este repositório não contém evidência de backup de
produção.** A inspeção encontrou o serviço PostgreSQL local de
`docker-compose.yml` com volume nomeado para desenvolvimento, mas não encontrou
provedor/banco de produção, agendador de backup, armazenamento remoto, regra de
retenção, configuração de criptografia ou rotina de restauração de backup real.
A definição de provedor e armazenamento continua em aberto em
`docs/product/08-requisitos-nao-funcionais.md`.

O bloqueio operacional concreto é a ausência da infraestrutura e da identidade
do banco de produção e do destino de backup. Sem esses recursos não há endpoint
real a inspecionar nem backup semanal dos últimos 90 dias a restaurar. Portanto,
o requisito continua sem evidência e nenhuma afirmação de retenção ou
restauração de produção é feita.

`npm run test:restore-smoke` exercita somente uma volta sintética: cria um
`pg_dump` local dentro do container temporário, restaura em outro banco
temporário e confere uma linha marcador. Isso valida as ferramentas PostgreSQL
no cenário descartável; não testa agenda semanal, retenção, armazenamento
externo nem um backup real.

#### Procedimento para validar um backup real

Execute este procedimento somente quando a equipe responsável fornecer o
provedor, o banco de origem e acesso autorizado ao catálogo de backups. Não
coloque URLs, credenciais, dados pessoais ou dumps no repositório.

1. Registre a política ativa do provedor: job habilitado, periodicidade semanal,
   destino de armazenamento e retenção configurada por pelo menos 90 dias.
2. Consulte o catálogo do destino. Confirme a cadência semanal e a existência
   de cópias cobrindo pelo menos 90 dias; salve referências não sensíveis às
   cópias e à tela/configuração que demonstra a política.
3. Escolha uma cópia recente e restaure-a para uma instância isolada, sem rota
   de escrita para produção. Use uma versão PostgreSQL compatível e mantenha o
   acesso restrito durante a verificação.
4. Guarde o resultado do serviço de restore e valide schema/migrations,
   integridade referencial e leitura dos fluxos críticos da aplicação no alvo
   isolado. Use verificações agregadas ou registros de teste, sem copiar dados
   pessoais para evidências.
5. Registre início, fim, duração, resultado e referências dos logs. Marque o
   RNF como verificado apenas quando política, catálogo de 90 dias e restauração
   isolada tiverem evidência positiva.

Registro de evidência a preencher após a execução real:

| Campo | Evidência |
| --- | --- |
| Data da verificação e responsável | Pendente |
| Provedor, banco de origem e job semanal | Pendente |
| Política de retenção e intervalo observado (mínimo 90 dias) | Pendente |
| Referência da cópia restaurada (sem URL ou credencial) | Pendente |
| Destino isolado, início/fim e duração do restore | Pendente |
| Resultado de schema, integridade e leitura dos fluxos críticos | Pendente |
| Referências não sensíveis a logs/configuração | Pendente |
| Resultado RNF-004 | **Não verificado** |

## RNF-005 — auditoria

O modelo `AuditEvent` guarda autor, entidade e identificador afetados, ação,
valores antes/depois, justificativa e data. `recordAuditEvent` grava eventos no
mesmo fluxo transacional das operações que o invocam; a consulta da tela de
auditoria restringe leitura a administradores. Os testes existentes verificam
os dados do evento e a restrição de acesso, incluindo alterações de presença e
de estado de Pessoa.

A política de retenção de auditoria continua uma decisão aberta no documento de
RNFs. Este registro confirma o armazenamento e a consulta existentes, mas não
define retenção operacional.

## Banco descartável para E2E

`npm run test:e2e` e os comandos acima exigem Docker e Chromium do Playwright.
Antes de iniciar Prisma ou Next.js, o runner executa testes do guard e cria um
container PostgreSQL novo com porta aleatória em `127.0.0.1`, credenciais
geradas para aquela execução e diretório de dados `tmpfs`. O `migrate reset
--force` só roda depois que o URL gerado passa pelo guard; um URL ausente,
remoto, padrão local ou fora do formato único é recusado. O runner sobrescreve
`DATABASE_URL` herdado do terminal para os processos da execução e remove o
container em `finally`.

O setup global e o comando que inicia o servidor também validam o URL. Assim,
uma chamada direta a Playwright sem o runner falha antes de iniciar o servidor
ou executar testes.

Os comandos abaixo criam seus próprios containers e aplicam migrations com
`prisma migrate reset --force` somente neles. Execute um comando por vez; não
inicie dois runners E2E ou comandos destrutivos de banco em paralelo:

```sh
npm run test:e2e -- --project=mobile-chromium
npm run test:capacity
npm run test:restore-smoke
npm run test:e2e
```

O último comando executa a suíte E2E inteira. Os cenários mobile e capacidade
estão preparados para execução isolada, mas seus resultados só devem ser
registrados depois de uma execução concluída. O smoke de restore fornece apenas
evidência sintética e não altera o status pendente do RNF-004.

## Verificação do checkout — 2026-11-09

- Build de produção, typecheck, validação do schema Prisma e whitespace passaram.
- Lint passou sem erros, com o aviso existente de `<img>` no perfil de Pessoas.
- Vitest sem integrações passou: **106/106 testes em 35 arquivos**.
- Segurança do runner E2E passou: **2/2 testes**.
- A suíte Vitest completa foi tentada, mas as integrações não conseguiram acessar
  PostgreSQL em `localhost:5433`. O Docker também estava indisponível; integrações
  e E2E não receberam nova evidência de aprovação nesta verificação.
- A verificação corrigiu a expectativa de consulta do teste de escopo do relatório
  e removeu a reexportação incompatível com `use server` no módulo de contas.
