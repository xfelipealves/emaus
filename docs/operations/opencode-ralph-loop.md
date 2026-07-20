# OpenCode Ralph Loop — Emaús

Este projeto usa o TLC Spec-Driven como fonte de verdade e o OpenCode como executor de uma task por vez. O modelo é configurável; a escolha inicial pode ser GPT-5.6, mas o script não fixa provedor nem modelo.

## Fontes obrigatórias

Antes de cada execução, o agente recebe e deve seguir:

1. `.specs/STATE.md` — handoff e próxima task;
2. `.specs/features/emaus-mvp/spec.md` — requisitos e critérios de aceite;
3. `.specs/features/emaus-mvp/design.md` — arquitetura e decisões técnicas;
4. `.specs/features/emaus-mvp/tasks.md` — escopo, dependências, testes, gate e mensagem de commit.

## Pré-requisitos verificados

- OpenCode disponível no PATH;
- OpenCode autenticado com provedor configurado;
- repositório limpo antes de começar uma task;
- modelo opcional configurado em `OPENCODE_MODEL`.

## Executar uma task

Sempre execute **uma única task**, espere o gate e revise o resultado antes de iniciar a próxima.

```bash
cd /home/felipe/clawd/repos/emaus
OPENCODE_MODEL='provider/model' ./scripts/run-emaus-task.sh T01
```

Exemplo quando o identificador do modelo final for confirmado no OpenCode:

```bash
OPENCODE_MODEL='provider/model-confirmado' ./scripts/run-emaus-task.sh T01
```

Se `OPENCODE_MODEL` for omitido, o OpenCode usa o modelo padrão da configuração local.

## Contrato do executor

O prompt embutido em `scripts/run-emaus-task.sh` obriga o OpenCode a:

- executar somente a task solicitada;
- validar todas as dependências antes de editar;
- não alterar escopo, arquitetura ou requisitos por conta própria;
- criar testes e rodar o gate indicado na task;
- parar e reportar bloqueio quando houver ambiguidade;
- atualizar o handoff do TLC e fazer um único commit atômico somente se o gate passar.

## Ciclo recomendado

1. Verificar árvore limpa: `git status --short --branch`.
2. Executar `T01` pelo script.
3. Conferir o resumo, o diff, os testes e o commit gerado.
4. Só então executar a task que o `STATE.md` indicar como próxima.
5. Ao fim de cada milestone, executar o Build Gate definido no `tasks.md`.
6. Ao fim de T36, disparar o Verifier TLC e criar `.specs/features/emaus-mvp/validation.md`.

## Regras de parada

Pare o loop e peça decisão humana se houver:

- dependência de task ainda não concluída;
- gate que não passa após investigação razoável;
- requisito sem critério de aceite claro;
- necessidade de segredo, credencial, serviço externo ou decisão de deploy;
- mudança de escopo ou custo relevante.

Não use um loop cego de shell para executar T01–T36 em sequência. A aprovação de cada commit/gate é a proteção contra propagação de erro entre módulos.
