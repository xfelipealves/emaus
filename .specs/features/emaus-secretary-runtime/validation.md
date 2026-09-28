# Estabilidade dos módulos para Secretaria — validação

**Spec**: `.specs/features/emaus-secretary-runtime/spec.md`  
**Design**: `.specs/features/emaus-secretary-runtime/design.md`  
**Status**: Bloqueado para E2E; aguarda nova autorização e entrega explícita do ambiente Playwright

## Gates concluídos antes da tentativa E2E

| Gate | Resultado | Evidência |
| --- | --- | --- |
| RED comportamental do boundary | Observado | A implementação provisória falhou nos três testes: texto genérico ausente/exceção exposta, fallback sem contrato de `reset` isolado e log sem `scope` estruturado. |
| Unitário do boundary | Passou | `rtk npm test -- 'src/app/(dashboard)/error.test.tsx'` — 3/3. |
| Suíte unitária sem integração | Passou | `rtk npm test -- --exclude '**/*.integration.test.ts'` — 11 arquivos, 33 testes. |
| TypeScript | Passou | `rtk ./node_modules/.bin/tsc --noEmit --incremental false`. |
| ESLint dos arquivos da frente | Passou | `rtk ./node_modules/.bin/eslint 'src/app/(dashboard)/error.tsx' 'src/app/(dashboard)/error.test.tsx' e2e/secretary-runtime.spec.ts`. |

## Tentativa Playwright interrompida

O preflight feito imediatamente antes da execução conectou ao banco `emaus_e2e_secretary`, confirmou que o usuário atual era o proprietário e encontrou zero outras sessões. Mesmo assim, o `globalSetup` do Playwright carregou as variáveis de `.env` e o Prisma CLI informou que o alvo do `migrate reset --force` era o banco `emaus`, em `localhost:5433`.

O reset no banco `emaus` terminou e o seed de demonstração foi executado. O primeiro caso Playwright terminou com sucesso; o processo foi interrompido antes dos outros quatro. **Esse resultado não é evidência válida para os critérios de aceitação**, pois a execução usou o banco errado. O setup aparentemente não recebeu ou não respeitou o `DATABASE_URL` que o preflight validou; a causa precisa ser resolvida pelo orquestrador antes de outra execução.

Após interromper, encerrei somente o web server que a minha execução iniciou. A porta `3102` foi verificada sem listener. Não fiz restauração, consulta ou nova operação de banco após o incidente. Não registrei URL, usuário, senha ou token.

## Estado de cobertura

- O source E2E contém cinco casos: agenda, detalhe da frequência sem mutação de presença, leitura de Ministérios sem formulários administrativos, fluxo de atividade/subtask com entrada inválida e persistência, e sessão expirada.
- Um caso foi executado, mas contra o alvo incorreto, e por isso não satisfaz a validação E2E.
- Quatro casos não foram executados.
- Build e testes de integração não foram executados.
- A validação E2E permanece pendente. Não tente novamente até que o `globalSetup` receba comprovadamente o alvo exclusivo `emaus_e2e_secretary`, sem depender de `.env` para selecionar outro banco, e o orquestrador libere uma nova janela serial.

## Próxima validação autorizada

1. O orquestrador deve escolher e validar o mecanismo de injeção da URL para o processo filho do Prisma/Playwright sem expor credenciais.
2. Antes do reset, confirmar por metadados que o CLI Prisma está conectado exatamente a `emaus_e2e_secretary`, com role proprietária e sem outras sessões.
3. Depois da confirmação, executar somente `e2e/secretary-runtime.spec.ts` em `PLAYWRIGHT_PORT=3102`, em janela serial.
4. Registrar o resultado de todos os cinco casos e confirmar que 3102 foi liberada.
