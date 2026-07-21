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
./scripts/ralph-loop.sh --model 'provider/model-confirmado' --max-tasks 1
```

`--max-tasks 1` é o padrão seguro. Após validar o piloto, é possível executar um lote limitado:

```bash
./scripts/ralph-loop.sh --model 'provider/model-confirmado' --max-tasks 3
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

## Ciclo do Draft PR

Em uma execução não simulada, o script valida `gh` e sua autenticação antes de
criar ou trocar de branch. Depois do primeiro push bem-sucedido de uma task, ele
consulta:

```bash
gh pr list --head "$RUN_BRANCH" --base "$BASE_BRANCH" --state open --json number,url,isDraft
```

Se não houver PR aberto para o par exato de branch, cria exatamente um Draft PR:

```bash
gh pr create --draft --base dev --head "$RUN_BRANCH" \
  --title "[$BATCH_ID] $SCOPE_SLUG" --body-file "$PR_BODY_FILE"
```

O corpo temporário contém lote, escopo, branches base/head, intervalo de tasks
do lote, resultado do gate, status do push, riscos conhecidos e checklist de QA.
Ele não inclui valores completos de ambiente ou credenciais. Cada task seguinte
e cada retomada atualizam o corpo do mesmo PR com `gh pr edit`; o script nunca
cria um segundo PR para o mesmo lote. `number`, `url`, `base`, `head` e `draft`
ficam persistidos em `.specs/loop-state.json`.

Se o push passar mas a criação ou atualização do PR falhar, o loop para sem
criar commit vazio. A branch e o commit permanecem preservados para uma nova
execução com `--resume`.

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
- existência de um commit novo;
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

## Regras de parada

Pare o loop e peça decisão humana se houver:

- dependência de task ainda não concluída;
- gate que não passa após investigação razoável;
- requisito sem critério de aceite claro;
- necessidade de segredo, credencial, serviço externo ou decisão de deploy;
- mudança de escopo ou custo relevante.

Não rode T01–T36 em um lote único. O loop é guardado por estado, commit e gate, mas milestones e mudanças de risco devem ser revisados em lotes curtos para evitar propagação de erro entre módulos.
