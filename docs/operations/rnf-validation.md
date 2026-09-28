# Validação operacional dos requisitos não funcionais

Este documento registra o que pode ser reproduzido no repositório e o que ainda
depende de infraestrutura externa. Os testes usam dados sintéticos e o runner
E2E cria um PostgreSQL exclusivo, publicado somente em loopback, com volume em
memória e remoção automática ao final.

## RNF-001 — 500 Pessoas e 20 sessões simultâneas

`npm run test:capacity` prepara exatamente 500 Pessoas sintéticas e 20 contas
sintéticas no banco descartável, faz login nas 20 contas e abre a lista de
Pessoas ao mesmo tempo em 20 contextos de navegador. O runner compila e serve a
aplicação em modo de produção local. O teste registra p50, p95 e máximo da
abertura simultânea de `/pessoas?status=all`; cada sessão precisa renderizar o
título da página dentro do timeout de 30 segundos usado pela asserção Playwright.

O requisito não define meta de latência ou taxa de erro. Por isso, a execução
registra as medições sem transformar um valor escolhido pela equipe de QA em
SLA de produto. O resultado local é evidência de repetibilidade com dados
sintéticos, não uma medição de produção nem uma garantia para hardware ainda não
especificado.

## RNF-002 — uso em celular

`npm run test:e2e -- --project=mobile-chromium` executa o projeto Playwright
Pixel 7. O cenário verifica ausência de rolagem horizontal no login, cadastro e
frequência; cadastra uma Pessoa pelo formulário e marca presença com toque em
um encontro sintético.

## RNF-004 — backup semanal, retenção de 90 dias e restauração

**Situação: não configurado e não verificável neste repositório.** A inspeção
encontrou o serviço PostgreSQL local de `docker-compose.yml` com volume nomeado
para desenvolvimento, mas não encontrou provedor/banco de produção, agendador
de backup, armazenamento remoto, regra de retenção, configuração de criptografia
ou rotina de restauração de backup real. A definição de provedor e armazenamento
continua em aberto em `docs/product/08-requisitos-nao-funcionais.md`.

O bloqueio operacional concreto é a ausência da infraestrutura e da identidade
do banco de produção e do destino de backup. Sem esses recursos não há endpoint
real a configurar, objeto remoto a inspecionar nem backup semanal dos últimos
90 dias a restaurar. Portanto, o requisito não está atendido por evidência e
nenhuma afirmação de retenção ou restauração de produção é feita.

`npm run test:restore-smoke` exercita somente uma volta sintética: cria um
`pg_dump` local dentro do container temporário, restaura em outro banco
temporário e confere uma linha marcador. Isso valida as ferramentas PostgreSQL
no cenário descartável; não testa agenda semanal, retenção, armazenamento
externo nem um backup real.

Para fechar o RNF-004, a infraestrutura precisa fornecer um banco de produção
identificado, backup automático semanal, armazenamento remoto com retenção
configurada para pelo menos 90 dias e um procedimento de restauração em destino
isolado. A operação deve registrar a data da cópia usada, resultado da
restauração e verificações de integridade sem colocar credenciais neste
repositório.

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
