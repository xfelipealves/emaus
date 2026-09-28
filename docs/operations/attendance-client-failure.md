# Falha do cliente no lançamento de frequência

## Causa confirmada

O quadro de frequência atualizava o estado visual antes de chamar a Server Action. Quando o transporte falhava, o `fetchServerAction` do Next.js rejeitava a chamada com `Runtime TypeError: Failed to fetch`. O manipulador não capturava a rejeição nem liberava o estado de salvamento, então a linha permanecia otimisticamente como presente e os botões ficavam desabilitados. Ao recarregar, a página lia novamente o estado persistido e exibia `Não confirmado`.

## Reprodução e evidência

A reprodução usou a conta demo com papel `SECRETARY` e um Postgres descartável, sem volume persistente. No encontro `QA Frequência Secretaria 2026-09-27`, interrompi o servidor antes de marcar `Demo Líder` como presente. O overlay mostrou `Runtime TypeError` e `Failed to fetch`, com a chamada apontando para `fetchServerAction` em `server-action-reducer.js`.

Confirmei a linha exata no banco: frequência `cmuk2on6100060l8tqvp12tsi`, pessoa `Demo Líder`, encontro `QA Frequência Secretaria 2026-09-27`, estado `NOT_CONFIRMED`. A consulta de auditoria pelo par `targetType = Attendance` e `targetId = cmuk2on6100060l8tqvp12tsi` encontrou zero eventos. O estado do banco, junto com a identidade do alvo, confirma que essa tentativa não gravou; a ausência isolada de um evento não foi usada como prova.

Na mesma sessão, o lançamento de `Demo Membro` no encontro QA foi concluído, permaneceu visualmente `Presente` após recarga e apareceu como `PRESENT` no banco. Isso confirma o caminho nominal e distingue a rejeição de transporte da gravação persistida.

## Proteções adicionadas

O quadro agora captura rejeições das ações, restaura o último estado confirmado, mostra uma mensagem com opção de nova tentativa e sempre libera o indicador de salvamento. Cada tentativa envia o estado esperado; a gravação usa comparação atômica de estado para que uma resposta perdida seguida de nova tentativa não avance a frequência duas vezes nem crie auditoria duplicada. Atualização, timeline e auditoria continuam na mesma transação.
