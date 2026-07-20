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
- repositório limpo antes de começar uma task;
- modelo opcional configurado em `OPENCODE_MODEL`.

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

Antes de chamar o modelo, valide a sequência planejada sem efeitos colaterais:

```bash
./scripts/ralph-loop.sh --dry-run --max-tasks 3
```

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
