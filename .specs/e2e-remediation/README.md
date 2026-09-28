# Especificações das frentes de melhoria do Emaús

**Origem:** E2E manual dos perfis Administrador, Secretaria e Líder, registrado em `docs/2026-09-25-levantamento-e2e-perfis.md`.

**Estado do pacote:** especificações em rascunho para revisão. Não autoriza implementação por si só. Os requisitos de produto existentes são a fonte; divergências e decisões ainda abertas aparecem explicitamente nos documentos.

## Busca por SKU

Na busca inicial pelas especificações e documentação preexistentes (antes deste pacote), não foi encontrada ocorrência literal de `SKU` em `.specs/`, `docs/` ou `README.md`. Nenhum conceito ou requisito de SKU foi acrescentado a este pacote.

## Frentes

| Frente | Documento | Requisitos principais | Situação E2E |
|---|---|---|---|
| 1. Frequência e auditoria | [`attendance-reliability/spec.md`](../features/emaus-attendance-reliability/spec.md) | RF-ENC-004/005, RF-TIM-001, RNF-005 | Mudança não confirmada no caso QA; requer reteste controlado. |
| 2. Runtime da Secretaria | [`secretary-runtime/spec.md`](../features/emaus-secretary-runtime/spec.md) | RF-ACS-007, ACT-01 a ACT-07 | Exceção de cliente reproduzida em várias rotas. |
| 3. Escopo do Líder | [`leader-access-scopes/spec.md`](../features/emaus-leader-access-scopes/spec.md) | RF-ACS-008/009, RF-ENC-004 | Listagem vazia; controles de concessão ausentes; cadastro contextual de visitante definido. |
| 4. Vínculos ministeriais | [`ministry-memberships/spec.md`](../features/emaus-ministry-memberships/spec.md) | RF-MIN-001/002/003, RF-TIM-001, RNF-005 | Operações de vínculo sem interface identificada. |
| 5. Ciclo de vida de pessoas | [`person-lifecycle/spec.md`](../features/emaus-person-lifecycle/spec.md) | RF-PES-001/002/003/005, RF-TIM-001/002/004 | Cadastro, nota e inativação passaram; data padrão e navegação falharam. |
| 6. Gestão de encontros | [`meeting-management/spec.md`](../features/emaus-meeting-management/spec.md) | RF-ENC-001/002/003, RF-ACS-006/008, RNF-003/005 | Encontro avulso passou; categoria e série não têm interface. |
| 7. Resumo por ministério | [`ministry-attendance-summary/spec.md`](../features/emaus-ministry-attendance-summary/spec.md) | RF-ENC-006, RF-ACS-006/007/008 | Consulta não encontrada; usuário definiu período, três estados e inclusão de encontros de toda a igreja para cada Ministério. |
| 8. Contas e navegação de configurações | [`account-settings/spec.md`](../features/emaus-account-settings/spec.md) | RF-ACS-001/003/004/005/006, RNF-005 | Rota raiz 404; recuperação ausente; criação de conta inconclusiva. |
| 9. Regressão de atividades | [`shared-activities-regression/spec.md`](../features/emaus-shared-activities-regression/spec.md) | ACT-01 a ACT-07 | Conclusão e exclusão QA persistiram; cancelamento não confirmado; Secretaria bloqueada. |
| 10. Base segura de validação | [`qa-validation-foundation/spec.md`](../features/emaus-qa-validation-foundation/spec.md) | RNF-001/002/004/005, requisitos de teste do MVP | Suíte não executada por reset destrutivo; celular, capacidade e backup não avaliados. |
| 11. Foto de perfil | [`profile-photo-upload/spec.md`](../features/emaus-profile-photo-upload/spec.md) | RF-PES-004, RNF-006 | Usuário decidiu implementar upload opcional nesta frente. |

## Uso

- Cada `spec.md` contém histórias, critérios de aceite WHEN/THEN/SHALL, casos de borda, rastreabilidade, escopo e pendências.
- `Draft` significa que os critérios ainda aguardam revisão do usuário/produto. Implementação, desenho técnico, tarefas e validação ficam para fases posteriores.
- Critérios referentes a lacunas de interface foram derivados dos requisitos aprovados. O comportamento que os requisitos deixaram em aberto permanece como decisão pendente ou hipótese claramente identificada.
