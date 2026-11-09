# Validação — gestão de vínculos ministeriais

**Spec**: `.specs/features/emaus-ministry-memberships/spec.md`  
**Reteste coordenado (2026-09-28)**: runner E2E serial passou 4/4 depois de alinhar os seletores à interface. Foram assertadas as datas efetivas exibidas para entrada (`10/01/2026`), mudança de cargo (`15/03/2026`) e saída (`30/06/2026`). O build de produção passou no gate consolidado anterior; typecheck/unit-only globais têm falhas em outras frentes.
**Verificação independente inicial (2026-09-28, antes de corrigir os seletores)**: ❌ FAIL — a execução-base falhou antes dos fluxos por divergência de título (1 falha, 3 casos seriais pulados); o sensor isolado matou o mutante de autorização da rota. A cobertura continua com as lacunas específicas descritas abaixo.

## Resumo da validação registrada antes desta rechecagem

| Critério | Evidência disponível | Estado |
|---|---|---|
| MEM-01 — Administrador consulta atuais e histórico; Secretaria/Líder sem acesso | Consulta administrativa protegida por verificação de papel na página e no serviço. E2E Admin navega pelo detalhe do Ministério e Secretaria/Líder recebem 404 pela URL direta. | E2E passou |
| MEM-02 — entrada com Pessoa/cargo/data, datas válidas, reentrada e auditoria/timeline | Integração cobre Pessoa ausente, cargos, datas inválida/futura, duplicidade, sobreposição, reentrada, concorrência e rollback. E2E cobre cadastro Admin, data padrão de São Paulo, valores, auditoria/timeline e rejeição de data futura sem gravação. | E2E passou; duplicidade coberta na integração |
| MEM-03 — mudança de cargo e saída preservando histórico | Integração cobre data/cargo, vínculo fechado, Ministério arquivado, autorização, auditoria/timeline e rollback. E2E conclui mudança de cargo → saída, valida o histórico, auditoria e timeline. | E2E passou |

## Verificador independente — evidência por AC

**Diff revisado**: implementação em `dd8b898` até `37b11a6`; rechecagem apenas dos arquivos atuais. O verificador não alterou implementação nem testes.
**Contagem**: 13 critérios explícitos (MEM-01: 4; MEM-02: 5; MEM-03: 4).

| AC | Resultado esperado na especificação | `file:line` + asserção/valor | Resultado |
|---|---|---|---|
| MEM-01.1 | A consulta Admin lista vigentes e encerrados com Pessoa, cargo e datas. | `src/features/ministerios/membership-service.integration.test.ts:219-223` — compara Pessoa e `role/endDate/startDate` em `currentMemberships` e `historicMemberships`; `e2e/ministry-memberships.spec.ts:67-70,95-97` — confere cargo e datas nas duas seções. | ✅ Assertivas cobrem os valores; execução E2E anterior 4/4, reexecução atual bloqueada na primeira asserção de título. |
| MEM-01.2 | O formulário lista Pessoas existentes, apenas `MEMBER`/`LEADER`, usa hoje em `America/Sao_Paulo` e aceita data ajustada. | `e2e/ministry-memberships.spec.ts:59-64` — `toHaveValue(currentBrazilDateInputValue())`, seleciona Pessoa/cargo e preenche a data; `membership-forms.tsx:24-31,43-45,68-80` — timezone, opções e input editável. | ✅ Asserções/interações e markup correspondem ao resultado. |
| MEM-01.3 | Secretaria/Líder recebe 404 sem título/controles e antes de carregar Pessoas. | `e2e/ministry-memberships.spec.ts:129-142` — `response.status() === 404`, título e botão ausentes; `page.tsx:23-30` — `notFound()` antes de chamar consulta que carrega Pessoas. | ✅ E2E 4/4; ambos os perfis foram exercitados. |
| MEM-01.4 | Operação direta por Secretaria/Líder é negada sem vínculo, timeline ou auditoria. | `membership-service.integration.test.ts:50-54` — criação por Secretaria rejeita; `:324-336` — mudança/saída para ambos os papéis rejeitam e preservam `role/endDate`, sem audit. `e2e/secretary-runtime.spec.ts:160-203` também envia chamadas diretas como Secretaria e verifica rejeição sem gravação; o caso passou na rodada integrada final. | ✅ E2E passou; integração cobre os dois papéis. |
| MEM-02.1 | Criação Admin em Ministério ativo salva Pessoa/cargo/data informados e aparece em vigentes. | `e2e/ministry-memberships.spec.ts:61-70` — submete `MEMBER` e `2026-01-10`, espera sucesso, “Membro” e “Desde 10/01/2026”; integração `:71-75` — valores persistidos e duas Pessoas em Ministérios distintos. | ✅ E2E atual 4/4, com valor persistido e visível. |
| MEM-02.2 | Timeline contém Ministério, cargo e data efetiva; audit contém autor e valores persistidos. | `e2e/ministry-memberships.spec.ts:74-77` — ator e `after.role/startDate` exatos; `:116-123` — descrição e `<time datetime>` renderizam 10/01, 15/03 e 30/06; `timeline/page.tsx:87-88` formata eventos `MINISTRY` como data de calendário. | ✅ E2E 4/4. A revisão encontrou e corrigiu o deslocamento de um dia causado pela renderização local de data armazenada à meia-noite UTC. |
| MEM-02.3 | Pessoa ausente, cargo/data inválidos, arquivo, duplicata ou sobreposição falham sem escrita parcial. | `membership-service.integration.test.ts:81-90,112-125,128-153,156-162,165-182` — cobre duplicata, sobreposição, datas, Pessoa ausente e arquivo; contagens de estado aparecem nos cenários de duplicata/sobreposição/datas/arquivo. | ⚠️ Falta teste de cargo inválido na criação; rejeição de Pessoa ausente não confere estado/eventos e alguns cenários não conferem audit após falha. |
| MEM-02.4 | Reentrada posterior à saída cria linha independente e preserva a anterior. | `membership-service.integration.test.ts:93-110` — início `2026-03-02`, contagem `2`, saída anterior mantida; `:112-125` — início na data da saída rejeitado e contagem permanece `1`. | ✅ Assertivas correspondem à regra estrita de não sobreposição. |
| MEM-02.5 | Falha ao gravar timeline ou audit reverte vínculo e eventos parciais. | `membership-service.integration.test.ts:395-438` — falha de persistência de audit e verifica rollback de criação, mudança de cargo e saída, inclusive contagem da timeline. | ⚠️ Sensor de falha cobre gravação de audit, não falha ao gravar timeline. |
| MEM-03.1 | Cargo vigente muda para o outro valor; data entre início e hoje; timeline/audit guardam data, antes/depois, ator e Ministério. | `membership-service.integration.test.ts:233-249` — `role === "LEADER"`, timeline `occurredAt === roleDate` e descrição com Ministério/antes/depois/data; audit `actorId`, `before.role`, `after.role/effectiveDate`. | ✅ Assertivas de domínio precisas; teste usa início 10/01/2026 e efetividade 15/03/2026. |
| MEM-03.2 | Saída em/apos início preenche `endDate`, preserva linha histórica e emite timeline/audit. | `membership-service.integration.test.ts:252-266` — saída persistida, descrição/data e ator/antes/depois; `e2e/ministry-memberships.spec.ts:93-109,116-123` — move à seção histórica, mantém cargo, datas/audit e timeline. | ✅ E2E atual 4/4. |
| MEM-03.3 | Data anterior/futura, cargo inválido, vínculo encerrado ou Ministério arquivado exibe erro e preserva dados. | `membership-service.integration.test.ts:273-350,353-376` — domínio rejeita e preserva estado/audit; E2E `:147-158` — o campo de entrada futura sinaliza `rangeOverflow`/`validationMessage` e DB continua sem vínculo/timeline. | ⚠️ Entrada futura tem feedback nativo verificado; feedback acessível das ações inválidas de cargo/saída ainda não está coberto na UI. |
| MEM-03.4 | Nova tentativa de encerrar vínculo já encerrado rejeita e mantém saída anterior. | `membership-service.integration.test.ts:267-270` — segunda saída rejeita e linha conserva `endDate`; E2E `:95-100` — vínculo histórico sem controles de encerramento/cargo. | ✅ Resultado e valor anterior assertados no teste de serviço. |

## Execução independente e sensor

- **Baseline E2E sem mutação, snapshot antes do ajuste do orquestrador**: `rtk run -c 'PLAYWRIGHT_PORT=3105 npm run test:e2e -- e2e/ministry-memberships.spec.ts'` em worktree descartável terminou com 1 falha e 3 casos pulados (a suíte está em modo serial). `e2e/ministry-memberships.spec.ts:55` procurava um título inexistente; a página renderiza `Vínculos de {ministryName}`. Após alinhar título, labels, regiões e seletores, a reexecução isolada passou 4/4 em 2026-09-28. O último run também confirmou os dias de calendário corretos na timeline.
- **Mutante discriminado**: em scratch, alterei a guarda da página para deixar Secretaria passar do `notFound()` (`page.tsx:25`). O teste isolado de Secretaria, pelo mesmo runner, falhou com `Expected 404 / Received 500`; o mutante foi morto pela asserção `e2e/ministry-memberships.spec.ts:124`. A guarda original foi descartada com o worktree.
- **Sensor**: profundidade leve, 1 mutante efetivo / 1 morto. Uma tentativa preliminar de inverter cargo não é contada: o heading incorreto fez o teste falhar antes de executar a operação mutada.
- **Isolamento/limpeza**: os runs usaram apenas o runner, que criou/removou PostgreSQL temporário em tmpfs; nenhum `.env`/banco padrão foi usado. Worktree de sensor removido; sem container E2E temporário restante.

### Lacunas em ordem de prioridade

1. Completar a prova de MEM-02.3: rejeição de cargo inválido na criação com contagens zero e estado/eventos após tentativa com Pessoa ausente.
2. Completar MEM-02.5 com rollback provocado por falha real ao gravar timeline, além da falha de audit já coberta.
3. Completar MEM-01.4 com evidência de estado/audit/timeline inalterados para chamada forjada de Líder; a cobertura ampliada da Secretaria aguarda E2E isolado.
4. Completar MEM-03.3 com feedback acessível das ações inválidas de cargo/saída, além da validação de domínio e da restrição nativa de data futura.

**Lições**: houve sinal de AC gap; nenhum registro foi adicionado a `lessons.json` porque este passe está restrito a alterar somente `validation.md`.

## RED → GREEN

- **T1 — entrada e intervalos**: baseline de integração falhou em duplicidade, sobreposição, data inválida e concorrência. Após a validação e a transação serializável, os cenários foram separados para cobrir data inválida, data futura e Pessoa ausente; a suíte passou 12/12 no banco descartável.
- **T2 — alteração/saída**: baseline de integração falhou em 9 cenários, incluindo data efetiva na auditoria, descrição da timeline, datas inválidas/futuras, cargo fora do conjunto fixo e vínculo encerrado. A suíte passou 23/23; falha real de chave estrangeira ao persistir auditoria demonstrou rollback de criação, mudança de cargo e saída, sem vínculo/evento parcial. A suíte atual da frente passou 26/26.
- **T3 — consulta**: o teste de serviço falhou porque a função administrativa não existia. Após implementá-la, a suíte de serviço passou. A primeira tentativa de E2E expirou aguardando `webServer`, antes de qualquer cenário. Na execução serial autorizada, Admin navegou pelo link do detalhe e Secretaria/Líder receberam 404.
- **T4/T5 — actions e UI**: na primeira rodada serial, Admin concluiu entrada → cargo → saída, Secretaria e Líder receberam 404, e a mensagem correta de data futura apareceu. O teste ficou 3/4 porque `getByRole('alert')` também localizou o announcer vazio do Next; isso foi uma falha do locator, não da regra de data. Com `p[role="alert"]`, a versão de `e2e/ministry-memberships.spec.ts` usando `domcontentloaded` passou 4/4. Depois, uma tentativa de trocar esperas das rotas interativas para `load` falhou antes do formulário: o link de gestão não apareceu no detalhe dentro do timeout do locator e os outros três casos foram pulados. A configuração de espera foi revertida exatamente para a versão verde `domcontentloaded` + locator restrito; não se declara RED funcional para T4/T5.

## Gates executados

Os testes de integração e a suíte completa foram executados com `DATABASE_URL` redirecionada no processo para o banco descartável `emaus_e2e_memberships`. Nenhum reset ou escrita foi direcionado ao banco de desenvolvimento.

| Gate | Resultado |
|---|---|
| `npm test -- src/features/ministerios/membership-service.integration.test.ts` | Passou: 26/26 testes. |
| `npm test` | Passou: 33 arquivos, 154 testes. |
| `npm run typecheck` | Passou (`tsc --noEmit`). |
| `npm run db:validate` | Passou; schema válido, sem migration nova nesta frente. |
| `npm run lint` | Passou, 0 erros. Um warning existente de `<img>` em `src/app/(dashboard)/pessoas/[personId]/page.tsx`, fora dos paths desta frente. |
| `PLAYWRIGHT_PORT=3105 npm run test:e2e -- e2e/ministry-memberships.spec.ts` | Chromium, 4/4 cenários, 59,2s em 2026-09-28. Runner criou e removeu PostgreSQL descartável em tmpfs; migrações/seed e servidor terminaram. Duas tentativas intermediárias não contam como baseline: uma excedeu o timeout de 30s do teste antes da navegação da timeline; outra coincidiu com runner concorrente e excedeu `webServer` 120s sem iniciar cenários. A execução final serial passou após elevar o timeout do fluxo longo para 60s. |
| `npm run build` | Passou no gate consolidado de 2026-09-28: Next compilou, validou tipos e gerou as páginas com PostgreSQL temporário em tmpfs. |

## Resultado combinado do workspace

Na verificação posterior das cinco frentes, `npm run typecheck` falhou em `src/features/auth/account-service.integration.test.ts` porque importa `resetAccountPassword`, que não existe no serviço de contas; a falha é externa a esta frente. A suíte unit-only ficou 51/52 por ausência de link de categorias em `src/app/(dashboard)/encontros/page.test.tsx`, também externa. Os 154 testes Vitest e o typecheck registrados acima passaram no gate isolado anterior desta frente. O build consolidado passou em 2026-09-28. O teste adicional de capacidade `e2e/capacity.spec.ts`, executado depois do build pelo modo de capacidade, excedeu 180 s e falhou no teardown do trace; o container temporário foi removido. Essa falha não pertence aos quatro cenários funcionais desta frente.

## Cenários E2E executados

Execução serial no banco descartável em tmpfs, porta `3105`:

1. Admin acessa o detalhe do Ministério, segue o link, vê os vínculos e cria uma entrada; conferir cargo, data, auditoria e timeline.
2. Secretaria e Líder recebem 404 ao abrir a rota administrativa diretamente.
3. Campo de entrada futura acusa `rangeOverflow` e disponibiliza mensagem nativa; tentativa não grava vínculo nem timeline.
4. Admin altera cargo e encerra o vínculo; conferir mudança para histórico, datas, auditoria e eventos da timeline.
5. Build de produção passou no gate consolidado de 2026-09-28.

As próximas execuções E2E devem passar pelo runner atual, que cria Postgres temporário em tmpfs: `rtk run -c 'PLAYWRIGHT_PORT=3105 npm run test:e2e -- e2e/ministry-memberships.spec.ts'`. Não use Playwright direto nem aponte E2E a um banco fixo. Lint final passou sem erros, com um warning existente de `<img>`; `db:validate` e `git diff --check` passaram.

## Rodada integrada final — 2026-09-28

`e2e/ministry-memberships.spec.ts` e asserções de chamada direta da Secretaria passaram dentro do comando serial de sete specs: **31/31 E2E em 3,8 min**, usando `emaus_e2e_fc00faf5c5da` em PostgreSQL temporário tmpfs, removido pelo runner. O teste confirma datas efetivas de entrada, mudança de cargo e saída (`10/01/2026`, `15/03/2026`, `30/06/2026`), tentativa de data futura sem gravação e acesso 404 para Secretaria/Líder.

Depois da rodada, unit-only passou **80/80 em 22 arquivos**, lint passou sem erros (um warning existente de `<img>`), `db:validate`, `git diff --check` e `test:e2e:safety` (2/2) passaram. Typecheck segue bloqueado apenas pelo import ausente `resetAccountPassword` em teste de integração de Contas. Restam gaps de cobertura: cargo inválido na criação e estado/audit após algumas rejeições, fault injection específico de falha ao gravar timeline e feedback acessível na UI para erros de cargo/saída. O build de produção passou no estado atual pelo runner temporário com `rtk run -c 'npm run test:capacity -- --list'`; o cenário de capacidade foi apenas listado, não executado, e o banco tmpfs foi removido.
