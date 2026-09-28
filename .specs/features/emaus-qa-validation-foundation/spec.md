# Base segura para validação E2E e não funcional — especificação

**Status:** Draft; suíte automatizada não foi executada porque seu setup chama `prisma migrate reset --force`.

## Problema

O setup de E2E redefine o banco configurado, o que impede execução segura no ambiente local atual. Também ficaram sem avaliação a responsividade em celular, capacidade mínima e política de backup. README, seed e fixture indicam credenciais demo que divergiram da credencial aceita pelo ambiente E2E.

## Objetivos

- [ ] Isolar dados automatizados para que E2E não destrua dados de desenvolvimento.
- [ ] Definir evidência repetível para RNF-001, RNF-002 e RNF-004.
- [ ] Manter fixture e documentação sem credenciais reais ou divergentes.
- [ ] Registrar limitações de desempenho sem inventar SLA inexistente.

## Fora de escopo

| Item | Motivo |
|---|---|
| Redesenhar toda a estratégia de testes de unidade | Esta frente cobre segurança do setup E2E e evidências dos RNFs não testados. |
| PWA, offline ou aplicativo nativo | Explicitamente fora do MVP por RNF-002/AD-001. |
| Meta de latência não aprovada | Nenhuma meta de resposta foi definida nas fontes atuais. |
| Escolher provedor de backup | RNF-004 reserva decisão de provedor/armazenamento/criptografia à arquitetura/infra. |

## Premissas e decisões pendentes

| Tema | Padrão | Racional | Confirmado? |
|---|---|---|---|
| Banco E2E | Base descartável, distinta do banco local/produção; reset somente após provar que a URL é de teste | Evita perda de dados. | Necessário para execução segura. |
| Capacidade | Exercitar 500 pessoas e 20 usuários simultâneos e validar integridade dos fluxos | Limites expressos em RNF-001. | Sim; latência-alvo não definida. |
| Celular | Executar cadastro e frequência em viewport móvel representativo | RNF-002 exige uso em celular durante encontro. | Sim; dimensão exata fica para design/test plan. |
| Backup | Verificar execução automática semanal e retenção de ao menos 90 dias | RNF-004. | Sim; provedor e restauração ainda são decisões de arquitetura/infra. |
| Credenciais demo | Declarar fonte de configuração e manter seed, documentação e fixtures coerentes sem gravar senha sensível | Divergência vista no E2E. | Pendente de definir source of truth. |

**Questões em aberto:** definir tamanho mínimo de viewport representativo, perfil de carga dentro dos 500/20 e limiar de latência se produto desejar; teste de restauração depende da política de infraestrutura, sem inventar critérios nesta fase.

## Histórias e critérios de aceite

### P1 — Executar E2E sem risco ao banco local

1. **WHEN** suíte E2E inicia **THEN** o setup **SHALL** apontar para banco temporário/discartável e confirmar que não coincide com desenvolvimento ou produção.
2. **WHEN** configuração usa URL não reconhecida como banco de teste **THEN** o setup **SHALL** falhar antes de qualquer `reset`, drop, seed destrutivo ou migration reset.
3. **WHEN** suíte termina ou falha **THEN** resultados e logs **SHALL** identificar ambiente/commit e não deixar fixtures ambíguas na base compartilhada.
4. **WHEN** um cenário cria dados **THEN** ele **SHALL** usar identificadores QA únicos e limpar apenas registros criados pelo próprio cenário.

**Teste independente:** apontar a suíte a banco efêmero, executar fluxo E2E e verificar que banco de desenvolvimento fica intacto; apontar por engano a uma URL protegida e verificar bloqueio pré-reset.

### P1 — Validar capacidade e celular

1. **WHEN** cenário contém 500 Pessoas e até 20 usuários simultâneos **THEN** operações requeridas de cadastro, consulta e frequência **SHALL** preservar dados corretos e concluir sem erro funcional.
2. **WHEN** cadastro e frequência são operados em tela móvel com conexão **THEN** controles necessários **SHALL** permanecer visíveis e utilizáveis para completar o fluxo sem operação paralela em desktop.
3. **WHEN** resultados de carga são publicados **THEN** o relatório **SHALL** separar taxa de erro/integridade de medições de duração, sem afirmar SLA não aprovado.

### P1 — Confirmar backup

1. **WHEN** ambiente cumpre RNF-004 **THEN** deve haver evidência de execução automática semanal e política de retenção mínima de 90 dias.
2. **WHEN** a evidência de configuração não comprova a retenção/periodicidade **THEN** requisito **SHALL** permanecer não validado, sem inferência por existência de snapshots pontuais.

### P2 — Sincronizar conta demo

1. **WHEN** documentação, seed e fixture são usadas em ambiente demo **THEN** todas **SHALL** apontar para a mesma fonte de credenciais/configuração vigente.
2. **WHEN** documentação é atualizada **THEN** **SHALL NOT** incluir senha real, token ou cookie.

## Casos de borda

- Falha antes do reset ou seed deixa bancos não alvo intactos.
- Setup não faz fallback silencioso para banco local.
- Carga concorrente não pode gerar perda/duplicação de presença ou pessoa.
- Backup pontual não prova retenção histórica de 90 dias.
- Visualização móvel é verificada nos fluxos definidos, sem afirmar uso offline.

## Rastreabilidade

| ID | Fonte | Critérios | Status |
|---|---|---|---|
| QA-01 | `e2e/global-setup.ts`, critérios de teste no MVP | E2E 1–4 | Draft |
| QA-02 | RNF-001 | Capacidade 1 e 3 | Draft |
| QA-03 | RNF-002 | Celular 2 | Draft |
| QA-04 | RNF-004 | Backup 1–2 | Draft |
| QA-05 | README, `prisma/seed.ts`, `e2e/demo-fixtures.ts` | Demo 1–2 | Draft |

**Cobertura:** 5 requisitos/controles rastreados; thresholds não definidos permanecem explicitamente pendentes.

## Sucesso

- [ ] E2E pode ser executado sem risco ao banco local.
- [ ] Os limites RNF de capacidade são verificados com integridade correta.
- [ ] Cadastro e frequência completam em viewport móvel.
- [ ] Backup automático semanal e retenção >=90 dias possuem evidência verificável.
- [ ] Fixture e documentação não divergem sobre a credencial configurada.
