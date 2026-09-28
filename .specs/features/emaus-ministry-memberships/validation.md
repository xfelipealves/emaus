# Validação — gestão de vínculos ministeriais

**Spec**: `.specs/features/emaus-ministry-memberships/spec.md`  
**Estado**: Parcial; validação de domínio, gates estáticos e E2E (4/4) passaram. Build aguarda o gate consolidado do coordenador.

## Evidência por critério

| Critério | Evidência disponível | Estado |
|---|---|---|
| MEM-01 — Administrador consulta atuais e histórico; Secretaria/Líder sem acesso | Consulta administrativa protegida por verificação de papel na página e no serviço. E2E Admin navega pelo detalhe do Ministério e Secretaria/Líder recebem 404 pela URL direta. | E2E passou |
| MEM-02 — entrada com Pessoa/cargo/data, datas válidas, reentrada e auditoria/timeline | Integração cobre Pessoa ausente, cargos, datas inválida/futura, duplicidade, sobreposição, reentrada, concorrência e rollback. E2E cobre cadastro Admin, data padrão de São Paulo, valores, auditoria/timeline e rejeição de data futura sem gravação. | E2E passou; duplicidade coberta na integração |
| MEM-03 — mudança de cargo e saída preservando histórico | Integração cobre data/cargo, vínculo fechado, Ministério arquivado, autorização, auditoria/timeline e rollback. E2E conclui mudança de cargo → saída, valida o histórico, auditoria e timeline. | E2E passou |

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
| `PLAYWRIGHT_PORT=3105 npm run test:e2e -- e2e/ministry-memberships.spec.ts` | Versão final verde: Chromium, 4/4 cenários, 51,4s. A tentativa posterior de `load` foi revertida para exatamente esta configuração já aprovada. Banco resetado e semeado exclusivamente em `emaus_e2e_memberships`; servidor encerrou e porta liberada. |
| `npm run build` | Pendente para o gate consolidado do coordenador. |

## Cenários E2E executados

Execução serial no banco descartável `emaus_e2e_memberships`, porta `3105`:

1. Admin acessa o detalhe do Ministério, segue o link, vê os vínculos e cria uma entrada; conferir cargo, data, auditoria e timeline.
2. Secretaria e Líder recebem 404 ao abrir a rota administrativa diretamente.
3. Data de entrada futura mostra alerta sem gravar vínculo/timeline.
4. Admin altera cargo e encerra o vínculo; conferir mudança para histórico, datas, auditoria e eventos da timeline.
5. Build pendente no gate consolidado.
