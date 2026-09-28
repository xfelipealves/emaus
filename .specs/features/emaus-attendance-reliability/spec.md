# Frequência confiável e auditável — especificação

**Status:** Implementada e validada em 2026-09-27; evidências em `validation.md`.

## Problema

No encontro QA futuro do Administrador, a presença permaneceu visualmente “Não confirmado” após dois cliques e após recarregar. A auditoria exibiu uma atualização de frequência sem informação suficiente na tela para ligá-la a uma pessoa e encontro específicos. A sessão da Secretaria não chegou ao quadro de frequência por uma exceção de cliente, portanto a persistência sob esse papel ainda não foi verificada.

## Objetivos

- [ ] Fazer cada mudança de estado de presença persistir imediatamente e apresentar o resultado real.
- [ ] Preservar a sequência de estados, a autorização por encontro, a timeline e a auditoria requeridas.
- [ ] Tornar cada evento auditável rastreável até presença, pessoa e encontro.

## Escopo

- Quadro de frequência de encontro não cancelado.
- Transição entre `não confirmado`, `presente` e `ausente`.
- Tratamento de erro, repetição e registro em auditoria/timeline.
- Permissões dos perfis autorizados para o encontro.

## Fora de escopo

| Item | Motivo |
|---|---|
| Alterar a regra de elegibilidade da lista | A decisão vigente calcula pessoas elegíveis pelos vínculos atuais ao abrir a frequência. |
| Novos estados de presença ou fechamento manual | Os requisitos definem três estados e não exigem fechamento. |
| Tornar obrigatório o motivo textual da correção | AD-007 e RF-ENC-005 mantêm o motivo opcional. |

## Premissas e decisões pendentes

| Tema | Padrão proposto | Motivo | Confirmado? |
|---|---|---|---|
| Encontro futuro | Permitir lançamento enquanto o encontro não estiver cancelado/arquivado e o ator tiver acesso | RF-ENC-004 não restringe lançamento pela data do encontro. | Sim, deriva do requisito. |
| Resultado de erro | Reverter estado otimista e mostrar erro contextual com opção de nova tentativa | Critério já definido na especificação consolidada do MVP. | Sim. |
| Clique repetido durante gravação | Desabilitar a linha enquanto a operação estiver pendente e exibir o estado retornado pelo servidor | Evita perder transição concorrente; a UI atual já desabilita enquanto salva. | Confirmado por integração e E2E. |
| Evento de auditoria legível | Exibir pessoa e encontro além do tipo e identificador do registro | O operador precisa localizar a ocorrência no histórico observado. | Confirmado por integração e E2E. |

**Questões em aberto:** nenhuma pendente para o escopo desta spec.

## Histórias e critérios de aceite

### P1 — Lançar presença com resultado confirmado

Como usuário autorizado no encontro, quero alternar presença e receber confirmação fiel para operar a frequência com segurança.

1. **WHEN** a frequência de encontro acessível e não cancelado é aberta **THEN** o sistema **SHALL** apresentar cada pessoa elegível inicialmente como `não confirmado`, sem duplicar registros quando a página for reaberta.
2. **WHEN** o usuário aciona uma pessoa **THEN** o sistema **SHALL** persistir a transição na ordem `não confirmado → presente → ausente → não confirmado` e mostrar o estado retornado pelo servidor.
3. **WHEN** a operação está pendente **THEN** o sistema **SHALL** impedir uma segunda transição concorrente para a mesma linha até receber o resultado da primeira.
4. **WHEN** a persistência falha **THEN** o sistema **SHALL** restaurar o estado anterior, informar a falha e oferecer nova tentativa; a interface não poderá indicar presença salva.
5. **WHEN** a nova tentativa é enviada após falha **THEN** o sistema **SHALL** aplicar no máximo uma transição por solicitação aceita e manter o estado exibido igual ao persistido.

**Teste independente:** abrir um encontro QA autorizado, percorrer os três estados e verificar cada um depois de recarregar; simular falha e confirmar reversão/retentativa sem alteração parcial.

### P1 — Registrar correção e histórico

Como administrador responsável pela operação, quero rastrear cada alteração de presença para preservar o histórico.

1. **WHEN** uma presença muda **THEN** o sistema **SHALL** gravar ator, data/hora, entidade afetada, estado anterior e posterior e motivo opcional na auditoria.
2. **WHEN** uma presença muda **THEN** o sistema **SHALL** acrescentar evento de frequência na timeline da pessoa.
3. **WHEN** o administrador consulta auditoria **THEN** o sistema **SHALL** permitir identificar a pessoa e o encontro associados ao evento, além do estado anterior e posterior.
4. **WHEN** usuário sem acesso ao encontro tenta listar ou alterar presenças **THEN** o sistema **SHALL** negar a operação sem expor dados do quadro.
5. **WHEN** um encontro está cancelado ou seu ministério arquivado impede novas presenças **THEN** o sistema **SHALL** rejeitar o lançamento e manter os registros históricos existentes.

**Teste independente:** mudar uma presença QA, conferir auditoria e timeline pelo alvo correto e tentar a mesma operação com um perfil fora do escopo.

## Casos de borda

- Pessoa sem vínculo elegível não deve ser incluída automaticamente; adição manual segue RF-ENC-004.
- Falha de rede não pode deixar a interface em desacordo com o estado persistido.
- Duas ações rápidas na mesma presença não podem saltar um estado sem retorno correspondente.
- Encontro cancelado e Ministério arquivado mantêm leitura histórica conforme as regras vigentes, sem novo lançamento.
- Os registros QA devem usar pessoas e encontros sintéticos, sem tocar em presença semeada.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| FREQ-01 | RF-ENC-004 | História de lançamento 1–5 | Validado |
| FREQ-02 | RF-ENC-005 | História de histórico 1, 3 e 4 | Validado |
| FREQ-03 | RF-TIM-001 | História de histórico 2 | Validado |
| FREQ-04 | RNF-005 | História de histórico 1 e 3 | Validado |
| FREQ-05 | AD-004 e RF-ENC-003 | Casos de borda e acesso | Validado |

**Cobertura:** 5 requisitos mapeados; testes unitários, de integração e E2E executados. Ver `.specs/features/emaus-attendance-reliability/validation.md`.

## Sucesso

- [x] Admin e Secretaria lançam nos cenários autorizados; Líder opera apenas encontros do escopo concedido.
- [x] Estados exibidos após reload coincidem com os valores persistidos.
- [x] Falhas revertem o estado otimista e não criam sucesso falso.
- [x] Auditoria e timeline identificam a pessoa e o encontro afetados.
