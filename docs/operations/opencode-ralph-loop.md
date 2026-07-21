# OpenCode Ralph Loop — Emaús

Este projeto usa o TLC Spec-Driven como fonte de verdade e o OpenCode como executor de uma task por vez. O modelo é configurável; a escolha inicial pode ser GPT-5.6, mas o script não fixa provedor nem modelo.

## Fontes obrigatórias

Antes de cada execução, o agente recebe e deve seguir:

1. `.specs/STATE.md` — handoff e decisões persistentes;
2. `.specs/loop-state.json` — estado de máquina: task atual, tasks concluídas, gate e último commit;
3. `.specs/features/emaus-mvp/spec.md` — requisitos e critérios de aceite;
4. `.specs/features/emaus-mvp/design.md` — arquitetura e decisões técnicas;
5. `.specs/features/emaus-mvp/tasks.md` — escopo, dependências, testes, gate e mensagem de commit.

## Pré-requisitos verificados

- OpenCode disponível no PATH;
- OpenCode autenticado com provedor configurado;
- GitHub CLI (`gh`) disponível no PATH e autenticado com `gh auth status`;
- repositório limpo antes de começar uma task;
- modelo opcional configurado em `OPENCODE_MODEL`.

O Ralph não executa `gh auth login`, não lê nem manipula credenciais e para com
uma instrução explícita de instalação ou login quando o pré-flight falha.

## Executar uma task ou o loop

Para executar uma task explicitamente:

```bash
cd /home/felipe/clawd/repos/emaus
OPENCODE_MODEL='provider/model' ./scripts/run-emaus-task.sh T01
```

Exemplo quando o identificador do modelo final for confirmado no OpenCode:

```bash
OPENCODE_MODEL='provider/model-confirmado' ./scripts/run-emaus-task.sh T01
```

Se `OPENCODE_MODEL` for omitido, o OpenCode usa o modelo padrão da configuração local.

Para deixar o Ralph Loop consumir automaticamente a task atual e avançar somente após um commit e gate bem-sucedidos:

```bash
./scripts/ralph-loop.sh \
  --model 'provider/model-confirmado' \
  --batch L001 \
  --scope m3-auth-access \
  --max-tasks 1
```

`--max-tasks 1` é o padrão seguro. Após validar o piloto, é possível executar um lote limitado:

```bash
./scripts/ralph-loop.sh \
  --model 'provider/model-confirmado' \
  --batch L001 \
  --scope m3-auth-access \
  --max-tasks 3
```

Flags operacionais:

- `--model <provider/model>` — modelo usado pelo OpenCode; também pode ser definido em `OPENCODE_MODEL`.
- `--max-tasks <n>` — máximo de tasks consecutivas; o padrão é `1`.
- `--batch <Lnnn>` — identificador do lote; obrigatório fora de `--dry-run`.
- `--scope <scope>` — escopo do lote, usado para formar a branch `lote/<batch>-<scope-slug>`; obrigatório fora de `--dry-run`.
- `--base-branch <branch>` — branch base do lote e do PR; o padrão é `dev`.
- `--resume` — retoma a branch e o metadata persistidos, incluindo o mesmo PR.
- `--dry-run` — mostra a sequência sem chamar OpenCode ou executar `gh`, checkout, push ou operações de PR.

Antes de chamar o modelo, valide a sequência planejada sem efeitos colaterais:

```bash
./scripts/ralph-loop.sh --dry-run --max-tasks 3
```

Em uma execução real, `ralph-loop.sh` cria a branch `lote/<batch>-<scope-slug>`
a partir de `origin/dev`, publica o estado inicial e abre ou reutiliza o Draft PR
antes de chamar o executor. Não crie essa branch manualmente. Para uma branch de
lote já existente, use `--resume` com o mesmo batch, escopo e checkout da
branch registrada.

## Ciclo do Draft PR

Em uma execução não simulada, o script valida `gh` e sua autenticação antes de
criar ou trocar de branch. Antes da primeira task e antes de cada task seguinte,
ele consulta:

```bash
gh pr list --head "$RUN_BRANCH" --base "$BASE_BRANCH" --state open --json number,url,isDraft
```

No primeiro início, se ainda não houver PR, cria exatamente um Draft PR. Depois
disso, o par exato deve sempre ter exatamente um PR aberto e Draft. Zero, múltiplos
PRs ou um PR já pronto interrompem o fluxo com segurança, sem executar outra task
nem publicar outro commit de task:

```bash
gh pr create --draft --base dev --head "$RUN_BRANCH" \
  --title "[$BATCH_ID] $SCOPE_SLUG" --body-file "$PR_BODY_FILE"
```

O corpo temporário contém lote, escopo, branches base/head, intervalo de tasks
do lote, SHAs completos dos commits, resultado individual de cada gate, status
do push, riscos conhecidos e checklist de QA.
Ele não inclui valores completos de ambiente ou credenciais. Cada task seguinte
e cada retomada atualizam o corpo do mesmo PR com `gh pr edit`; o script nunca
cria um segundo PR para o mesmo lote. `number`, `url`, `base`, `head` e `draft`
ficam persistidos em `.specs/loop-state.json`. Os metadados de lote, PR e push
são commits de estado controlados pelo runner; o fluxo não usa `skip-worktree` nem
overlays locais. Assim, um clone novo da branch publicada consegue retomar sem
depender de metadata do índice local.

## QA Independente do Lote

Depois que o lote terminar, execute a QA independente a partir da própria branch
do lote. O script exige os metadados persistidos, a branch exata, uma árvore
limpa, `HEAD == origin/<runBranch>`, `lastPush.sha` publicado no histórico remoto, um
Draft PR para o par `dev`/head correto e a extensão de tasks registrada desde o
`baseSha`. Antes de determinar o diff, a QA atualiza `origin/dev`; a comparação e
o log abrangem o intervalo completo `origin/dev...HEAD`, não apenas o último
commit:

```bash
RALPH_START_COMMAND='npm run dev -- --hostname 127.0.0.1' \
RALPH_APP_URL='http://127.0.0.1:3000' \
RALPH_BROWSER_VIEWPORTS='desktop,mobile' \
RALPH_BROWSER_QA_COMMAND='comando-de-browser-qa' \
./scripts/ralph-qa.sh --batch L001 --scope m3-auth-access
```

O hook definido em `RALPH_BROWSER_QA_COMMAND` recebe estas variáveis e o arquivo
de checklist em `RALPH_BROWSER_QA_CHECKLIST`:

- `RALPH_APP_URL` e `RALPH_BROWSER_VIEWPORTS` para iniciar e validar o app em
  desktop e mobile;
- `RALPH_QA_DIFF_BASE`, `RALPH_QA_DIFF_HEAD` e `RALPH_QA_TASK_RANGE` para
  conferir o escopo completo e as tasks afetadas;
- `RALPH_BROWSER_QA_CHECKLIST` com os critérios de aceite das tasks concluídas.

O hook deve verificar navegação, estados de carregamento/vazio/erro, console,
requisições de rede, foco/teclado e todos os critérios de aceite relevantes. O
script registra o PID e a URL do app, recusa uma porta já ocupada, exige que o
listener pronto pertença à árvore de processos iniciada pela QA, confirma que o
PID continua vivo depois do health check e encerra a árvore de processos ao
terminar. Assim, uma resposta `curl` de um servidor preexistente nunca prova a
prontidão do app testado. Nem o hook nem a QA podem editar código da aplicação;
uma árvore suja faz a QA falhar.

As gates automatizadas rodam nesta ordem, usando exatamente o ambiente do
chamador:

```text
npm run db:validate
npm run typecheck
npm run lint
npm run build
npm run test
npm run test:integration
npm run test:e2e
```

A primeira falha interrompe o fluxo, preserva seu status, não chama `gh pr ready`
e mantém o PR como Draft. Quando todas as gates e a QA de browser passarem, o
script atualiza o checklist do PR, refaz imediatamente a validação de
`origin/dev`, do `HEAD` remoto do lote, do loop state local/remoto, do base/head e
Draft do PR e do SHA/diff testados, e só então executa `gh pr ready <PR_NUMBER>`.
Qualquer mudança nessa janela mantém o PR como Draft e interrompe o fluxo. Ele
nunca faz merge. O hook de browser é obrigatório para evitar que uma aprovação
automática seja confundida com uma validação visual incompleta.

Se a publicação de estado, a criação ou a atualização do PR falhar, o loop para
sem executar outra task. Os commits e o estado rastreado permanecem preservados
para uma nova execução com `--resume`.

## Contrato do executor

O prompt embutido em `scripts/run-emaus-task.sh` obriga o OpenCode a:

- executar somente a task solicitada;
- validar todas as dependências antes de editar;
- não alterar escopo, arquitetura ou requisitos por conta própria;
- criar testes e rodar o gate indicado na task;
- parar e reportar bloqueio quando houver ambiguidade;
- atualizar o handoff do TLC e `.specs/loop-state.json`, então fazer um único commit atômico somente se o gate passar.

O `scripts/ralph-loop.sh` também verifica, após cada chamada ao OpenCode:

- árvore Git limpa;
- existência de exatamente um novo commit do executor;
- transição sequencial sem tasks puladas; commits adicionais são somente os
  commits controlados de publicação dos metadados do runner;
- avanço correto da task atual para a próxima;
- parada obrigatória em `blocked`, `verification_required` ou `complete`.

## Ciclo recomendado

1. Verificar árvore limpa: `git status --short --branch`.
2. Fazer `--dry-run` para confirmar a task que será consumida.
3. Rodar o loop com `--max-tasks 1` como piloto.
4. Conferir o resumo, o diff, os testes e o commit gerado.
5. Aumentar o lote apenas quando o piloto estiver confiável.
6. Ao fim de cada milestone, executar o Build Gate definido no `tasks.md`.
7. Ao fim de T36, o loop para em `verification_required`; então disparar o Verifier TLC e criar `.specs/features/emaus-mvp/validation.md`.
8. Ao fim de um lote, executar a [QA independente](#qa-independente-do-lote)
   antes de solicitar revisão ou merge manual.

## Regras de parada

Pare o loop e peça decisão humana se houver:

- dependência de task ainda não concluída;
- gate que não passa após investigação razoável;
- requisito sem critério de aceite claro;
- necessidade de segredo, credencial, serviço externo ou decisão de deploy;
- mudança de escopo ou custo relevante.

Não rode T01–T36 em um lote único. O loop é guardado por estado, commit e gate, mas milestones e mudanças de risco devem ser revisados em lotes curtos para evitar propagação de erro entre módulos.
