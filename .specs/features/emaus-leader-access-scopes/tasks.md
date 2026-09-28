# Escopo ministerial de Líderes — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill, following its Execute flow and Critical Rules. Tests are run against the dedicated database `emaus_e2e_leader_scopes`; never reset the development database. During concurrent feature work, changes remain unstaged and uncommitted until the coordinator reviews exact paths.

---

**Design**: `.specs/features/emaus-leader-access-scopes/design.md`  
**Status**: In Progress

## Test Coverage Matrix

> Confirmed against the codebase, project guidelines, and spec. Guidelines: `AGENTS.md`, `package.json`, `playwright.config.ts`, Vitest integration tests under `src/features/**`, and Playwright specs under `e2e/`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Access scope/domain services and admin settings query | Integration | 1:1 to LEAD-01/02; grant/revoke validation, repeat-state edge cases, and current grants shown to Admin | `src/features/ministerios/*.integration.test.ts` | `npm run test -- src/features/ministerios/access-scope-service.integration.test.ts src/features/ministerios/ministry-service.integration.test.ts` |
| Contextual visitor registration | Integration | 1:1 to LEAD-03; authorized, denied, persisted audit/timeline/attendance, rollback behavior | `src/features/encontros/quick-visitor-service.integration.test.ts` | `npm run test -- src/features/encontros/quick-visitor-service.integration.test.ts` |
| Attendance query adapter | Integration | Existing public quick-visitor call reaches the atomic service and returns the ID, status, and name consumed by the attendance action/UI | `src/features/encontros/attendance-query.integration.test.ts` | `npm run test -- src/features/encontros/attendance-query.integration.test.ts` |
| Admin and Leader flows | E2E | Isolated Admin/Leader browser contexts; Admin grant/revoke UI + audit; Leader list/detail and visitor in authorized frequency; denial without scope and no general People access | `e2e/leader-access-scopes.spec.ts` | `PLAYWRIGHT_PORT=3104 DATABASE_URL=<emaus_e2e_leader_scopes> npm run test:e2e -- e2e/leader-access-scopes.spec.ts` |
| Type/build/lint regression | Build | Type correctness, lint, production compilation | project root | `npm run typecheck && npm run lint && npm run build` |

## Gate Check Commands

> Generated from codebase — confirmed from `package.json` and `playwright.config.ts`.

| Gate Level | When to Use | Command |
| ---------- | ---------- | ------- |
| Quick | Service/integration task | `DATABASE_URL=<isolated-url-ending-in-emaus_e2e_leader_scopes> npm run test -- <test paths>` |
| Full | Adapter/UI task with E2E or integration | `PLAYWRIGHT_PORT=3104 DATABASE_URL=<isolated-url-ending-in-emaus_e2e_leader_scopes> npm run test:e2e -- e2e/leader-access-scopes.spec.ts` plus focused integration tests |
| Build | Feature completion | `npm run typecheck && npm run lint && npm run build && DATABASE_URL=<isolated-url-ending-in-emaus_e2e_leader_scopes> npm run test` |

## Execution Plan

Phases are ordered. The coordinator defers commits until the shared parallel worktree is integrated and reviewed.

### Phase 1: Domain foundations

```text
T1 → T2 → T3
```

### Phase 2: Flow wiring and user acceptance

```text
T4 → T5
```

## Task Breakdown

### T1: Harden grant/revoke lifecycle

**What**: Make Administrator-only grants, revocations, re-grants, idempotence, validation, and before/after audit consistent.
**Where**: `src/features/ministerios/access-scope-service.ts`, `src/features/ministerios/access-scope-service.integration.test.ts`
**Depends on**: None
**Reuses**: `canManageAccounts`, `withTransaction`, `recordAuditEvent`
**Requirement**: LEAD-02

**Done when**:

- [x] Tests prove active grant, revoke preserving the same record, and re-grant updating the active timestamp.
- [x] Tests prove only Administrator can manage scopes; non-Leader target and archived/nonexistent Ministry are rejected without partial access.
- [x] Tests prove repeated active grant is state-idempotent and already-revoked scope cannot be revoked again or have its timestamp overwritten.
- [x] Audit assertions prove actor, target type/id, action, and before/after grant/revocation values.
- [x] Focused integration gate passes with no tests skipped or removed; RED had 3 failed assertions before service changes, GREEN has 6 passing tests including the Administrator settings query.

**Tests**: integration  
**Gate**: quick

### T2: Resolve Leader ministry list from persisted scopes

**What**: Load active account role/status/scopes from the database for Leader ministry listing and deny list/profile access after revoke or account deactivation.
**Where**: `src/features/ministerios/ministry-service.ts`, `src/features/ministerios/ministry-service.integration.test.ts`
**Depends on**: T1
**Reuses**: `canAccessMinistry`, `getMinistryProfile`
**Requirement**: LEAD-01

**Done when**:

- [x] A Leader whose passed actor has an empty scope array still sees only active Ministries with persisted current grants.
- [x] A revoked grant and a Ministry with no current grant are absent from listing, and profile lookup returns `null`.
- [x] An inactive account gets no Leader-scoped result; non-Leader listing remains broad for active accounts.
- [x] Focused integration gate passes with no tests skipped or removed; RED had 1 failed assertion before service change, GREEN has 6 passing tests.

**Tests**: integration  
**Gate**: quick

### T3: Create a contextual visitor atomically

**What**: Add a frequency-only service that validates live account/meeting scope and writes visitor, initial attendance, timeline, and audit in one transaction.
**Where**: `src/features/encontros/quick-visitor-service.ts`, `src/features/encontros/quick-visitor-service.integration.test.ts`
**Depends on**: T1
**Reuses**: `canManageMeeting`, `recordTimelineEvent`, `recordAuditEvent`
**Requirement**: LEAD-03

**Done when**:

- [x] An authorized Leader creating with full name only persists a `VISITOR`, one `NOT_CONFIRMED` attendance for the scoped meeting, a registration timeline event, and a Person `CREATE` audit event.
- [x] No-scope/revoked scope and inactive account are rejected before visitor/attendance/timeline/audit state; blank name is rejected without writes.
- [x] A failed audit step after Person/timeline creation rolls back the full transaction, leaving no visitor, attendance, timeline or audit state.
- [x] Focused integration gate passes with no tests skipped or removed (5/5 tests).

**Tests**: integration  
**Gate**: quick

### T4: Wire the quick-visitor entry point to the atomic service

**What**: Preserve the attendance query API while delegating visitor creation to the contextual service and verify the exact result fields consumed by the attendance action/UI.
**Where**: `src/features/encontros/attendance-query.ts`, `src/features/encontros/attendance-query.integration.test.ts`
**Depends on**: T3
**Reuses**: Existing `addQuickVisitor` server action call; no change to the meeting page action/component.
**Requirement**: LEAD-03

**Done when**:

- [x] Existing `addQuickVisitor` entry point returns attendance ID, linked Person ID/name, and `NOT_CONFIRMED` status consumed by the server action and board.
- [x] Its integration test confirms audit/timeline and one persisted attendance for the new Person.
- [x] Focused integration gate passes with no tests skipped or removed; behavior RED reproduced “Você não tem permissão para gerenciar Pessoas” before delegation, GREEN has 11 passing tests across adapter + service.

**Tests**: integration  
**Gate**: full

### T5: Provide Administrator scope settings and verify complete Admin/Leader E2E

**What**: Query current Leader grants for the administrator page, add grant/revoke controls to User Settings, distinguish the Leader's no-scope state, and verify grant → scoped access/visitor registration → revoke → denial and audit as browser E2E.
**Where**: `src/features/ministerios/access-scope-service.ts` (settings query), `src/app/(dashboard)/configuracoes/usuarios/{page.tsx,actions.ts,ministry-access-form.tsx}`, `src/app/(dashboard)/ministerios/page.tsx`, `e2e/leader-access-scopes.spec.ts`.
**Depends on**: T1, T2, T4
**Reuses**: Existing account settings route, `useActionState`, demo/Playwright patterns, existing attendance UI actions.
**Requirement**: LEAD-01, LEAD-02, LEAD-03

**Done when**:

- [x] E2E Admin configures and revokes access using visible controls; non-Administrator is redirected away from the settings UI, and the domain service rejects both grant and revoke attempts.
- [x] E2E Leader sees the granted active Ministry and its participants, registers a visitor only in that meeting’s frequency, and sees initial `Não confirmado` attendance.
- [x] E2E after revoke confirms `/ministerios` omits that Ministry and direct detail/frequency access is denied; persisted grant/revoke audit events have correct actor/target/action/before/after.
- [x] Leader without current grants sees an explicit no-access empty state, never the misleading global “no Ministry exists” message.
- [ ] E2E plus all feature integration tests pass on the isolated database; then typecheck, lint, build, and full test suite pass.
- [ ] No `SPEC_DEVIATION` is unrecorded; validation report contains per-AC evidence.

**TDD evidence**: The admin settings-query integration case first failed against an empty-result implementation because the current grant was omitted; the semantic database query then passed with the full scope-service suite. The E2E file was authored before route wiring. The first browser attempts exposed ambiguous locators and an SSR/hydration race when navigating with `domcontentloaded`; the accepted run waits for the frequency page `load` and the server action POST before asserting the visitor row. See `validation.md` for run sequence and outcomes.

**Tests**: E2E + integration  
**Gate**: build

## Phase Execution Map

```text
Phase 1 → Phase 2

Phase 1: T1 ──→ T2 ──→ T3
                     │
Phase 2:             T4 ──→ T5
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Harden grant/revoke lifecycle | One service/API and its integration suite | ✅ Granular |
| T2: Resolve ministry listing from persisted grants | One query service and its integration suite | ✅ Granular |
| T3: Atomic contextual visitor service | One service and its integration suite | ✅ Granular |
| T4: Wire visitor entry point | One API adapter and integration suite | ✅ Granular |
| T5: Admin query, grant/revoke UI, empty state, and acceptance E2E | One cohesive user capability end-to-end | ✅ Cohesive |

## Diagram-Definition Cross-Check

| Task | Depends on | Diagram shows | Status |
| --- | --- | --- | --- |
| T1 | None | No incoming arrow | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T1 | T1 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T1, T2, T4 | T1/T2/T4 → T5 | ✅ |

## Test Co-location Validation

| Task | Code layer | Matrix requires | Task says | Status |
| --- | --- | --- | --- | --- |
| T1 | Domain service | Integration | Integration | ✅ |
| T2 | Query service/repository | Integration | Integration | ✅ |
| T3 | Domain service | Integration | Integration | ✅ |
| T4 | Domain integration adapter | Integration | Integration | ✅ |
| T5 | Admin query/actions, settings UI, Leader user flows | E2E + integration | E2E + integration | ✅ |
